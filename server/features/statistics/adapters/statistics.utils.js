const toId = (value) => {
  if (!value) return '';
  if (value._id) return value._id.toString();
  return value.toString();
};

const asNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const round = (value, digits = 2) => {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const average = (sum, count) => (count > 0 ? round(sum / count) : null);

const newestDate = (item) => (
  item.playedAt || item.endTime || item.verifiedAt || item.updatedAt || item.createdAt || null
);

const sortNewestFirst = (items) => [...items].sort((a, b) => (
  new Date(newestDate(b) || 0) - new Date(newestDate(a) || 0)
));

const rosterHasUser = (roster = [], userId) => {
  const id = toId(userId);
  if (!id) return false;
  return roster.some((member) => toId(member.userId) === id);
};

module.exports = {
  asNumber,
  average,
  newestDate,
  rosterHasUser,
  round,
  sortNewestFirst,
  toId
};
