const toId = (value) => {
  if (!value) return '';
  if (value._id) return value._id.toString();
  return value.toString();
};

const sortNewestFirst = (items) => [...items].sort((a, b) => (
  new Date(b.occurredAt || 0) - new Date(a.occurredAt || 0)
));

const formatStatus = (registration, tournament) => {
  if (tournament?.status === 'completed' && registration.status === 'verified') {
    return 'completed_participation';
  }
  if (registration.status === 'verified') return 'verified';
  if (registration.status === 'images_uploaded') return 'verification_submitted';
  return 'registered';
};

module.exports = {
  formatStatus,
  sortNewestFirst,
  toId
};
