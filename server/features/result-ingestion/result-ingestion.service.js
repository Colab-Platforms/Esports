const cloudinary = require('../../config/cloudinary');
const Tournament = require('../../models/Tournament');
const TournamentRegistration = require('../../models/TournamentRegistration');
const freeFireResultsService = require('../freefire-results/freefire-results.service');
const ResultIngestionJob = require('./result-ingestion.model');
const { normalizeFreeFireScoreboard } = require('./adapters/freefire-scoreboard.adapter');
const pythonOcrClient = require('./ocr/python-ocr-client');
const {
  GAME_TYPES,
  INGESTION_FAILURE_REASONS,
  INGESTION_SOURCE_TYPES,
  INGESTION_STATUSES,
  SCOREBOARD_LAYOUTS
} = require('./result-ingestion.constants');
const {
  assertNonNegativeNumber,
  assertPositiveInteger,
  computeImageHash,
  parseNumber,
  responseError,
  safeRows,
  safeStringList,
  toId,
  validateImageFile
} = require('./result-ingestion.utils');

const uploadScoreboardImage = (file) => new Promise((resolve, reject) => {
  const stream = cloudinary.uploader.upload_stream(
    {
      folder: 'result-ingestion/freefire',
      resource_type: 'image',
      format: file.mimetype === 'image/png' ? 'png' : 'jpg'
    },
    (error, result) => {
      if (error) return reject(error);
      resolve(result);
    }
  );
  stream.end(file.buffer);
});

const loadFreeFireTournament = async (tournamentId) => {
  const tournament = await Tournament.findById(tournamentId).select('name gameType').lean();
  if (!tournament) throw responseError('Tournament not found', 404, 'TOURNAMENT_NOT_FOUND');
  if (tournament.gameType !== GAME_TYPES.FREEFIRE) {
    throw responseError('Scoreboard ingestion is only available for Free Fire tournaments', 400, 'INVALID_GAME_TYPE');
  }
  return tournament;
};

const normalizeJob = (job) => ({
  id: toId(job),
  gameType: job.gameType,
  tournamentId: toId(job.tournamentId),
  status: job.status,
  source: job.source || {},
  input: job.input || {},
  rawExtraction: job.rawExtraction || { rows: [] },
  normalizedDraft: job.normalizedDraft || { teamResults: [] },
  warnings: job.warnings || [],
  failedReason: job.failedReason || '',
  confirmedResultId: toId(job.confirmedResultId),
  createdBy: toId(job.createdBy),
  reviewedBy: toId(job.reviewedBy),
  reviewedAt: job.reviewedAt,
  createdAt: job.createdAt,
  updatedAt: job.updatedAt
});

const isRetryableIngestionStatus = (status) => [
  INGESTION_STATUSES.FAILED,
  INGESTION_STATUSES.REVIEW_REQUIRED
].includes(status);

const isDuplicateProtectedStatus = (status) => [
  INGESTION_STATUSES.PENDING,
  INGESTION_STATUSES.PROCESSING,
  INGESTION_STATUSES.REVIEW_REQUIRED,
  INGESTION_STATUSES.CONFIRMED
].includes(status);

const normalizeTechnicalFailure = (error) => {
  const detail = error.response?.data?.detail;
  if (detail && typeof detail === 'object') {
    return {
      code: detail.code || INGESTION_FAILURE_REASONS.OCR_SERVICE_ERROR,
      message: detail.message || 'OCR service failed while processing this image.'
    };
  }

  const message = typeof detail === 'string' ? detail : error.message;
  if (!message || message === 'Error') {
    return {
      code: INGESTION_FAILURE_REASONS.OCR_SERVICE_ERROR,
      message: 'OCR service failed while processing this image.'
    };
  }

  if (/decode|image|invalid/i.test(message)) {
    return {
      code: INGESTION_FAILURE_REASONS.INVALID_IMAGE,
      message: 'The uploaded image could not be decoded by the OCR service.'
    };
  }

  return {
    code: INGESTION_FAILURE_REASONS.OCR_SERVICE_ERROR,
    message: `OCR service failed: ${String(message).slice(0, 160)}`
  };
};

const normalizeRawExtraction = (extraction, normalized) => ({
  provider: 'python-ocr',
  rows: safeRows(extraction?.rows || extraction?.teams || extraction?.data?.rows || []),
  detectedText: safeStringList(extraction?.detectedText),
  headers: safeStringList(extraction?.headers),
  layout: normalized.layout || extraction?.layout || SCOREBOARD_LAYOUTS.UNKNOWN,
  reasonCode: normalized.reasonCode || extraction?.reasonCode || '',
  imageMetadata: {
    width: extraction?.imageMetadata?.width || null,
    height: extraction?.imageMetadata?.height || null,
    preprocessing: safeStringList(extraction?.imageMetadata?.preprocessing, { maxItems: 12, maxLength: 60 })
  },
  warnings: safeStringList(extraction?.warnings, { maxItems: 20, maxLength: 220 }),
  message: extraction?.message || ''
});

const processJobWithOcr = async ({ job, tournamentId, input }) => {
  try {
    const extraction = await pythonOcrClient.processFreeFireScoreboardImage({ imageUrl: job.source.imageUrl });
    const registrations = await TournamentRegistration.find({ tournamentId, status: 'verified' })
      .select('teamName teamId status')
      .lean();
    const normalized = normalizeFreeFireScoreboard({ extraction, registrations, input });

    job.status = INGESTION_STATUSES.REVIEW_REQUIRED;
    job.rawExtraction = normalizeRawExtraction(extraction, normalized);
    job.normalizedDraft = normalized.normalizedDraft;
    job.warnings = normalized.warnings;
    job.failedReason = '';
    await job.save();
  } catch (error) {
    const failure = normalizeTechnicalFailure(error);
    job.status = INGESTION_STATUSES.FAILED;
    job.failedReason = `${failure.code}: ${failure.message}`;
    job.rawExtraction = {
      provider: 'python-ocr',
      rows: [],
      detectedText: [],
      headers: [],
      layout: SCOREBOARD_LAYOUTS.UNKNOWN,
      reasonCode: failure.code,
      imageMetadata: job.rawExtraction?.imageMetadata || {},
      warnings: [failure.message],
      message: failure.message
    };
    job.warnings = [failure.message];
    await job.save();
  }
};

const createFreeFireScoreboardJob = async ({ file, payload, actorId }) => {
  validateImageFile(file);
  const tournamentId = payload.tournamentId;
  if (!tournamentId) throw responseError('tournamentId is required');
  await loadFreeFireTournament(tournamentId);

  const input = {
    lobbyNumber: assertPositiveInteger(payload.lobbyNumber, 'lobbyNumber'),
    matchNumber: assertPositiveInteger(payload.matchNumber, 'matchNumber'),
    map: String(payload.map || '').trim()
  };
  const imageHash = computeImageHash(file.buffer);

  const existingJob = await ResultIngestionJob.findOne({
    gameType: GAME_TYPES.FREEFIRE,
    tournamentId,
    'source.imageHash': imageHash
  }).lean();
  if (existingJob) {
    return {
      job: normalizeJob(existingJob),
      duplicate: true,
      retryable: isRetryableIngestionStatus(existingJob.status),
      duplicateProtected: isDuplicateProtectedStatus(existingJob.status)
    };
  }

  const upload = await uploadScoreboardImage(file);
  let job = await ResultIngestionJob.create({
    gameType: GAME_TYPES.FREEFIRE,
    tournamentId,
    status: INGESTION_STATUSES.PROCESSING,
    source: {
      type: INGESTION_SOURCE_TYPES.SCOREBOARD_IMAGE,
      imageUrl: upload.secure_url,
      publicId: upload.public_id,
      imageHash
    },
    input,
    normalizedDraft: { ...input, teamResults: [] },
    createdBy: actorId
  });

  await processJobWithOcr({ job, tournamentId, input });

  return { job: normalizeJob(job.toObject()), duplicate: false };
};

const reprocessJob = async ({ jobId, actorId }) => {
  const job = await ResultIngestionJob.findById(jobId);
  if (!job) throw responseError('Result ingestion job not found', 404, 'INGESTION_JOB_NOT_FOUND');
  if (!isRetryableIngestionStatus(job.status)) {
    throw responseError('Only failed or review-required ingestion jobs can be reprocessed');
  }
  if (job.confirmedResultId || job.status === INGESTION_STATUSES.CONFIRMED) {
    throw responseError('Confirmed ingestion jobs cannot be reprocessed');
  }

  await loadFreeFireTournament(job.tournamentId);
  job.status = INGESTION_STATUSES.PROCESSING;
  job.reviewedBy = actorId;
  job.reviewedAt = new Date();
  await job.save();
  await processJobWithOcr({ job, tournamentId: job.tournamentId, input: job.input || {} });
  return normalizeJob(job.toObject());
};

const getJob = async ({ jobId }) => {
  const job = await ResultIngestionJob.findById(jobId).lean();
  if (!job) throw responseError('Result ingestion job not found', 404, 'INGESTION_JOB_NOT_FOUND');
  return normalizeJob(job);
};

const sanitizeReviewedDraft = (draft) => {
  if (!draft || !Array.isArray(draft.teamResults)) {
    throw responseError('normalizedDraft.teamResults is required');
  }

  return {
    lobbyNumber: draft.lobbyNumber === '' || draft.lobbyNumber === null ? null : parseNumber(draft.lobbyNumber),
    matchNumber: draft.matchNumber === '' || draft.matchNumber === null ? null : parseNumber(draft.matchNumber),
    map: String(draft.map || '').trim(),
    teamResults: draft.teamResults.map((row, index) => ({
      rowIndex: index,
      rawTeamName: String(row.rawTeamName || '').slice(0, 120),
      registrationId: row.registrationId || null,
      placement: row.placement === '' || row.placement === null ? null : parseNumber(row.placement),
      kills: row.kills === '' || row.kills === null ? null : parseNumber(row.kills),
      placementPoints: row.placementPoints === '' || row.placementPoints === null ? null : parseNumber(row.placementPoints),
      killPoints: row.killPoints === '' || row.killPoints === null ? null : parseNumber(row.killPoints),
      totalPoints: row.totalPoints === '' || row.totalPoints === null ? null : parseNumber(row.totalPoints),
      matchConfidence: row.matchConfidence || 'admin_reviewed',
      fieldConfidence: row.fieldConfidence || {},
      candidates: Array.isArray(row.candidates) ? row.candidates : [],
      warnings: Array.isArray(row.warnings) ? row.warnings : []
    }))
  };
};

const patchReview = async ({ jobId, payload, actorId }) => {
  const job = await ResultIngestionJob.findById(jobId);
  if (!job) throw responseError('Result ingestion job not found', 404, 'INGESTION_JOB_NOT_FOUND');
  if (![INGESTION_STATUSES.REVIEW_REQUIRED, INGESTION_STATUSES.FAILED].includes(job.status)) {
    throw responseError('Only reviewable ingestion jobs can be edited');
  }

  job.normalizedDraft = sanitizeReviewedDraft(payload.normalizedDraft || payload);
  job.status = INGESTION_STATUSES.REVIEW_REQUIRED;
  job.reviewedBy = actorId;
  job.reviewedAt = new Date();
  job.failedReason = '';
  await job.save();
  return normalizeJob(job.toObject());
};

const validateDraftForConfirm = (draft) => {
  const errors = [];
  const lobbyNumber = parseNumber(draft?.lobbyNumber);
  const matchNumber = parseNumber(draft?.matchNumber);
  if (!Number.isInteger(lobbyNumber) || lobbyNumber < 1) errors.push('Lobby number is required.');
  if (!Number.isInteger(matchNumber) || matchNumber < 1) errors.push('Match number is required.');
  if (!Array.isArray(draft?.teamResults) || draft.teamResults.length === 0) errors.push('At least one team result is required.');

  const seenRegistrations = new Set();
  const seenPlacements = new Set();

  (draft?.teamResults || []).forEach((row, index) => {
    const rowName = `Row ${index + 1}`;
    const registrationId = toId(row.registrationId);
    if (!registrationId) errors.push(`${rowName}: verified registration is required.`);
    if (registrationId && seenRegistrations.has(registrationId)) errors.push(`${rowName}: duplicate registration.`);
    if (registrationId) seenRegistrations.add(registrationId);

    try {
      const placement = assertPositiveInteger(row.placement, `${rowName} placement`);
      if (seenPlacements.has(placement)) errors.push(`${rowName}: duplicate placement.`);
      seenPlacements.add(placement);
    } catch (error) {
      errors.push(error.message);
    }

    for (const field of ['kills', 'placementPoints', 'killPoints', 'totalPoints']) {
      try {
        assertNonNegativeNumber(row[field], `${rowName} ${field}`);
      } catch (error) {
        errors.push(error.message);
      }
    }

    const placementPoints = parseNumber(row.placementPoints);
    const killPoints = parseNumber(row.killPoints);
    const totalPoints = parseNumber(row.totalPoints);
    if (Number.isFinite(placementPoints) && Number.isFinite(killPoints) && Number.isFinite(totalPoints) && placementPoints + killPoints !== totalPoints) {
      errors.push(`${rowName}: totalPoints must equal placementPoints + killPoints.`);
    }
  });

  if (errors.length) throw responseError(errors.join(' '));
};

const confirm = async ({ jobId, actorId }) => {
  const job = await ResultIngestionJob.findById(jobId);
  if (!job) throw responseError('Result ingestion job not found', 404, 'INGESTION_JOB_NOT_FOUND');
  if (job.status !== INGESTION_STATUSES.REVIEW_REQUIRED) {
    throw responseError('Only reviewed ingestion jobs can be confirmed');
  }

  validateDraftForConfirm(job.normalizedDraft);
  const result = await freeFireResultsService.createFreeFireResult({
    actorId,
    payload: {
      tournamentId: job.tournamentId,
      lobbyNumber: job.normalizedDraft.lobbyNumber,
      matchNumber: job.normalizedDraft.matchNumber,
      map: job.normalizedDraft.map || '',
      teamResults: job.normalizedDraft.teamResults.map((row) => ({
        registrationId: row.registrationId,
        placement: row.placement,
        kills: row.kills,
        placementPoints: row.placementPoints,
        killPoints: row.killPoints,
        totalPoints: row.totalPoints
      })),
      evidence: [{
        type: 'scoreboard_image',
        url: job.source.imageUrl,
        description: 'Imported Free Fire scoreboard image',
        isPublic: true
      }],
      status: 'draft'
    }
  });

  job.status = INGESTION_STATUSES.CONFIRMED;
  job.confirmedResultId = result._id || result.id;
  job.reviewedBy = actorId;
  job.reviewedAt = new Date();
  await job.save();

  return {
    job: normalizeJob(job.toObject()),
    result: freeFireResultsService.normalizeAdminFreeFireResult(result)
  };
};

const cancel = async ({ jobId, actorId }) => {
  const job = await ResultIngestionJob.findById(jobId);
  if (!job) throw responseError('Result ingestion job not found', 404, 'INGESTION_JOB_NOT_FOUND');
  if (job.status === INGESTION_STATUSES.CONFIRMED) {
    throw responseError('Confirmed ingestion jobs cannot be cancelled');
  }
  job.status = INGESTION_STATUSES.CANCELLED;
  job.reviewedBy = actorId;
  job.reviewedAt = new Date();
  await job.save();
  return normalizeJob(job.toObject());
};

module.exports = {
  cancel,
  confirm,
  createFreeFireScoreboardJob,
  getJob,
  isDuplicateProtectedStatus,
  isRetryableIngestionStatus,
  normalizeJob,
  normalizeTechnicalFailure,
  patchReview,
  reprocessJob,
  validateDraftForConfirm
};
