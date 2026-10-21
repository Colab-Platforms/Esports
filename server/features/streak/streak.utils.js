const DEFAULT_TIMEZONE = 'Asia/Kolkata';

const dayKeyFormatterCache = new Map();

const getFormatter = (timezone = DEFAULT_TIMEZONE) => {
  if (!dayKeyFormatterCache.has(timezone)) {
    dayKeyFormatterCache.set(
      timezone,
      new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      })
    );
  }

  return dayKeyFormatterCache.get(timezone);
};

const getDayKey = (date = new Date(), timezone = DEFAULT_TIMEZONE) => {
  const parts = getFormatter(timezone).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return `${values.year}-${values.month}-${values.day}`;
};

const parseDayKeyAsUtcNoon = (dayKey) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dayKey || '')) {
    throw new Error('Invalid day key');
  }

  const [year, month, day] = dayKey.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
};

const getPreviousDayKey = (dayKey, timezone = DEFAULT_TIMEZONE) => {
  const date = parseDayKeyAsUtcNoon(dayKey);
  date.setUTCDate(date.getUTCDate() - 1);

  return getDayKey(date, timezone);
};

module.exports = {
  DEFAULT_TIMEZONE,
  getDayKey,
  getPreviousDayKey
};
