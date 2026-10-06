const crypto = require('crypto');

const ALLOWED_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png']);
const ALLOWED_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png']);
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const responseError = (message, status = 400, code = 'VALIDATION_ERROR') => {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
};

const toId = (value) => {
  if (!value) return '';
  if (value._id) return value._id.toString();
  return value.toString();
};

const normalizeTeamName = (value) => (
  String(value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(team|esports|e sports|official|gaming|ff)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
);

const tokenSet = (value) => new Set(normalizeTeamName(value).split(' ').filter(Boolean));

const teamNameSimilarity = (left, right) => {
  const normalizedLeft = normalizeTeamName(left);
  const normalizedRight = normalizeTeamName(right);
  if (!normalizedLeft || !normalizedRight) return 0;
  if (normalizedLeft === normalizedRight) return 1;

  const leftTokens = tokenSet(normalizedLeft);
  const rightTokens = tokenSet(normalizedRight);
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;

  const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  const union = new Set([...leftTokens, ...rightTokens]).size;
  const jaccard = union ? intersection / union : 0;
  const contains = normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft) ? 0.78 : 0;
  return Math.max(jaccard, contains);
};

const matchConfidence = (score) => {
  if (score >= 1) return 'high';
  if (score >= 0.85) return 'medium';
  if (score > 0) return 'low';
  return 'unmatched';
};

const parseNumber = (value) => {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const assertPositiveInteger = (value, fieldName) => {
  const parsed = parseNumber(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw responseError(`${fieldName} must be a positive integer`);
  }
  return parsed;
};

const assertNonNegativeNumber = (value, fieldName) => {
  const parsed = parseNumber(value);
  if (parsed === undefined || parsed < 0) {
    throw responseError(`${fieldName} must be a non-negative number`);
  }
  return parsed;
};

const computeImageHash = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');

const validateImageFile = (file) => {
  if (!file) throw responseError('Scoreboard image is required');
  if (!Buffer.isBuffer(file.buffer) || file.buffer.length === 0) {
    throw responseError('Uploaded image is empty');
  }
  if (file.buffer.length > MAX_IMAGE_BYTES) {
    throw responseError('Scoreboard image must be 8MB or smaller');
  }

  const mimetype = String(file.mimetype || '').toLowerCase();
  if (!ALLOWED_IMAGE_MIME_TYPES.has(mimetype)) {
    throw responseError('Only JPG, JPEG, or PNG scoreboard images are supported');
  }

  const lowerName = String(file.originalname || '').toLowerCase();
  const extension = lowerName.includes('.') ? lowerName.slice(lowerName.lastIndexOf('.')) : '';
  if (!ALLOWED_IMAGE_EXTENSIONS.has(extension)) {
    throw responseError('Scoreboard image filename must end with .jpg, .jpeg, or .png');
  }
};

const safeRows = (rows) => (
  Array.isArray(rows)
    ? rows.slice(0, 100).map((row) => ({
      rawTeamName: String(row.rawTeamName || row.raw_team_name || row.teamName || row.team_name || '').slice(0, 120),
      placement: parseNumber(row.placement ?? row.rank),
      kills: parseNumber(row.kills),
      placementPoints: parseNumber(row.placementPoints ?? row.placement_points),
      killPoints: parseNumber(row.killPoints ?? row.kill_points),
      totalPoints: parseNumber(row.totalPoints ?? row.total_points ?? row.points),
      confidence: row.confidence || null
    }))
    : []
);

const safeStringList = (values, { maxItems = 80, maxLength = 120 } = {}) => (
  Array.isArray(values)
    ? values
      .map((value) => String(value || '').trim())
      .filter(Boolean)
      .slice(0, maxItems)
      .map((value) => value.slice(0, maxLength))
    : []
);

module.exports = {
  assertNonNegativeNumber,
  assertPositiveInteger,
  computeImageHash,
  matchConfidence,
  normalizeTeamName,
  parseNumber,
  responseError,
  safeRows,
  safeStringList,
  teamNameSimilarity,
  toId,
  validateImageFile
};
