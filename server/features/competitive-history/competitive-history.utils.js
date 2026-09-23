const STEAM64_BASE = BigInt('76561197960265728');

const toId = (value) => {
  if (!value) return '';
  if (value._id) return value._id.toString();
  return value.toString();
};

const asDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const parsePositiveInt = (value, fallback, max) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
};

const toSteamAccountId = (steamId) => {
  if (!steamId || typeof steamId !== 'string') return null;
  const normalized = steamId.trim();

  if (/^\d{1,10}$/.test(normalized)) {
    return Number.parseInt(normalized, 10);
  }

  if (/^7656119\d{10}$/.test(normalized)) {
    const accountId = BigInt(normalized) - STEAM64_BASE;
    if (accountId < 0 || accountId > BigInt(Number.MAX_SAFE_INTEGER)) return null;
    return Number(accountId);
  }

  const legacyMatch = normalized.match(/^STEAM_[01]:([01]):(\d+)$/);
  if (legacyMatch) {
    const y = Number.parseInt(legacyMatch[1], 10);
    const z = Number.parseInt(legacyMatch[2], 10);
    return (z * 2) + y;
  }

  const steam3Match = normalized.match(/^\[U:1:(\d+)\]$/);
  if (steam3Match) {
    return Number.parseInt(steam3Match[1], 10);
  }

  return null;
};

const getEventTime = (event) => asDate(event.occurredAt)?.getTime() || 0;

const sortNewestFirst = (events) => (
  [...events].sort((a, b) => getEventTime(b) - getEventTime(a) || String(b.id).localeCompare(String(a.id)))
);

const dedupeById = (events) => {
  const seen = new Set();
  return events.filter((event) => {
    if (!event?.id || seen.has(event.id)) return false;
    seen.add(event.id);
    return true;
  });
};

module.exports = {
  asDate,
  dedupeById,
  parsePositiveInt,
  sortNewestFirst,
  toId,
  toSteamAccountId
};
