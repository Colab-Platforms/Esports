const DEFAULT_HISTORY_LIMIT = 12;
const MAX_HISTORY_LIMIT = 30;

const PUBLIC_REGISTRATION_STATUSES = ['pending', 'images_uploaded', 'verified'];

const CONFIDENCE = {
  VERIFIED_RESULT: 'verified_result',
  SERVER_LOG: 'server_log',
  DERIVED: 'derived',
  PARTICIPATION_ONLY: 'participation_only'
};

module.exports = {
  CONFIDENCE,
  DEFAULT_HISTORY_LIMIT,
  MAX_HISTORY_LIMIT,
  PUBLIC_REGISTRATION_STATUSES
};
