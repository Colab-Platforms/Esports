const ACTIVE_GAMES = ['bgmi', 'freefire', 'valorant'];

const COVERAGE_NOTE = 'Stats are based on verified results available on Colab.';

const PUBLIC_REGISTRATION_STATUSES = ['pending', 'images_uploaded', 'verified'];
const COMPLETED_TOURNAMENT_STATUS = 'completed';

const supportedValue = (value) => ({
  value,
  supported: true
});

const unavailableValue = (reason) => ({
  value: null,
  supported: false,
  reason
});

module.exports = {
  ACTIVE_GAMES,
  COMPLETED_TOURNAMENT_STATUS,
  COVERAGE_NOTE,
  PUBLIC_REGISTRATION_STATUSES,
  supportedValue,
  unavailableValue
};
