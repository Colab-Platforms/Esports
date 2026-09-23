const mongoose = require('mongoose');

const RESULT_STATUSES = {
  DRAFT: 'draft',
  VERIFIED: 'verified',
  VOID: 'void'
};

const MANAGEMENT_ROLES = ['admin', 'moderator'];

const toId = (value) => {
  if (!value) return '';
  if (value._id) return value._id.toString();
  return value.toString();
};

const requireResultManager = (req, res, next) => {
  if (!req.user || !MANAGEMENT_ROLES.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'INSUFFICIENT_PERMISSIONS',
        message: 'Admin or moderator access required',
        timestamp: new Date().toISOString()
      }
    });
  }
  next();
};

const publicEvidence = (evidence = []) => (
  evidence
    .filter((item) => item && item.url && item.isPublic !== false)
    .map((item) => ({
      type: item.type || 'scoreboard_image',
      url: item.url,
      description: item.description || ''
    }))
);

const validationError = (message) => {
  const error = new Error(message);
  error.status = 400;
  error.code = 'VALIDATION_ERROR';
  return error;
};

const normalizeEvidenceInput = (evidence = []) => {
  if (!Array.isArray(evidence)) return [];
  return evidence
    .filter((item) => item && item.url)
    .map((item) => ({
      type: item.type || 'scoreboard_image',
      url: String(item.url).trim(),
      description: item.description ? String(item.description).trim() : '',
      isPublic: item.isPublic !== false
    }));
};

const riotGameId = (riotId) => {
  if (!riotId || !riotId.name || !riotId.tag) return '';
  return `${riotId.name}#${riotId.tag}`;
};

const rosterSnapshotForRegistration = (registration, gameType) => {
  const gameIdKey = gameType === 'valorant' ? 'riotId' : gameType === 'freefire' ? 'freeFireId' : 'bgmiId';
  const normalizeGameId = (player) => (
    gameIdKey === 'riotId' ? riotGameId(player?.riotId) : (player?.[gameIdKey] || '')
  );

  const members = [
    {
      userId: registration.userId || null,
      displayName: registration.teamLeader?.name || '',
      gameId: normalizeGameId(registration.teamLeader),
      role: 'leader'
    },
    ...(registration.teamMembers || []).map((member, index) => ({
      userId: null,
      displayName: member.name || '',
      gameId: normalizeGameId(member),
      role: `member${index + 1}`
    }))
  ];

  if (registration.substitutePlayer?.name) {
    members.push({
      userId: null,
      displayName: registration.substitutePlayer.name || '',
      gameId: normalizeGameId(registration.substitutePlayer),
      role: 'substitute'
    });
  }

  return members.filter((member) => member.displayName || member.gameId);
};

const assertNonNegativeNumber = (value, fieldName, { required = false } = {}) => {
  if (value === undefined || value === null || value === '') {
    if (required) throw validationError(`${fieldName} is required`);
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw validationError(`${fieldName} must be a non-negative number`);
  }

  return parsed;
};

const assertPositiveInteger = (value, fieldName, { required = false } = {}) => {
  const parsed = assertNonNegativeNumber(value, fieldName, { required });
  if (parsed === undefined) return undefined;
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw validationError(`${fieldName} must be a positive integer`);
  }
  return parsed;
};

module.exports = {
  MANAGEMENT_ROLES,
  RESULT_STATUSES,
  assertNonNegativeNumber,
  assertPositiveInteger,
  isValidObjectId: mongoose.Types.ObjectId.isValid,
  normalizeEvidenceInput,
  publicEvidence,
  requireResultManager,
  rosterSnapshotForRegistration,
  toId
};
