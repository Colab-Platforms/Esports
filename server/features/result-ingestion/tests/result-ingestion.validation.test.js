const test = require('node:test');
const assert = require('node:assert/strict');
const {
  isDuplicateProtectedStatus,
  isRetryableIngestionStatus,
  normalizeTechnicalFailure,
  validateDraftForConfirm
} = require('../result-ingestion.service');
const {
  INGESTION_FAILURE_REASONS,
  INGESTION_STATUSES
} = require('../result-ingestion.constants');

test('blocks duplicate registrations before confirm', () => {
  assert.throws(() => validateDraftForConfirm({
    lobbyNumber: 1,
    matchNumber: 1,
    teamResults: [
      {
        registrationId: '64f000000000000000000001',
        placement: 1,
        kills: 10,
        placementPoints: 12,
        killPoints: 10,
        totalPoints: 22
      },
      {
        registrationId: '64f000000000000000000001',
        placement: 2,
        kills: 6,
        placementPoints: 9,
        killPoints: 6,
        totalPoints: 15
      }
    ]
  }), /duplicate registration/);
});

test('blocks inconsistent total points before confirm', () => {
  assert.throws(() => validateDraftForConfirm({
    lobbyNumber: 1,
    matchNumber: 1,
    teamResults: [
      {
        registrationId: '64f000000000000000000001',
        placement: 1,
        kills: 10,
        placementPoints: 12,
        killPoints: 10,
        totalPoints: 99
      }
    ]
  }), /totalPoints must equal placementPoints \+ killPoints/);
});

test('normalizes generic technical OCR failure', () => {
  const failure = normalizeTechnicalFailure(new Error('Error'));
  assert.equal(failure.code, INGESTION_FAILURE_REASONS.OCR_SERVICE_ERROR);
  assert.match(failure.message, /OCR service failed/);
});

test('allows retry for failed and review-required jobs only', () => {
  assert.equal(isRetryableIngestionStatus(INGESTION_STATUSES.FAILED), true);
  assert.equal(isRetryableIngestionStatus(INGESTION_STATUSES.REVIEW_REQUIRED), true);
  assert.equal(isRetryableIngestionStatus(INGESTION_STATUSES.CONFIRMED), false);
  assert.equal(isRetryableIngestionStatus(INGESTION_STATUSES.PROCESSING), false);
});

test('protects duplicate successful or active jobs', () => {
  assert.equal(isDuplicateProtectedStatus(INGESTION_STATUSES.PROCESSING), true);
  assert.equal(isDuplicateProtectedStatus(INGESTION_STATUSES.REVIEW_REQUIRED), true);
  assert.equal(isDuplicateProtectedStatus(INGESTION_STATUSES.CONFIRMED), true);
  assert.equal(isDuplicateProtectedStatus(INGESTION_STATUSES.FAILED), false);
  assert.equal(isDuplicateProtectedStatus(INGESTION_STATUSES.CANCELLED), false);
});
