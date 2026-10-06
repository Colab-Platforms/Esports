const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeFreeFireScoreboard } = require('../adapters/freefire-scoreboard.adapter');
const {
  INGESTION_FAILURE_REASONS,
  SCOREBOARD_LAYOUTS
} = require('../result-ingestion.constants');

test('normalizes exact OCR team names to verified registrations', () => {
  const result = normalizeFreeFireScoreboard({
    input: { lobbyNumber: 1, matchNumber: 2, map: 'Bermuda' },
    registrations: [
      { _id: '64f000000000000000000001', teamName: 'Team Alpha', status: 'verified' },
      { _id: '64f000000000000000000002', teamName: 'Team Bravo', status: 'verified' }
    ],
    extraction: {
      rows: [
        {
          rawTeamName: 'Alpha',
          placement: 1,
          kills: 14,
          placementPoints: 12,
          killPoints: 14,
          totalPoints: 26,
          confidence: { row: 0.95 }
        }
      ]
    }
  });

  assert.equal(result.normalizedDraft.lobbyNumber, 1);
  assert.equal(result.normalizedDraft.matchNumber, 2);
  assert.equal(result.normalizedDraft.teamResults[0].registrationId, '64f000000000000000000001');
  assert.equal(result.normalizedDraft.teamResults[0].matchConfidence, 'high');
});

test('leaves unmatched OCR rows for admin review', () => {
  const result = normalizeFreeFireScoreboard({
    input: { lobbyNumber: 1, matchNumber: 1 },
    registrations: [
      { _id: '64f000000000000000000001', teamName: 'Team Alpha', status: 'verified' }
    ],
    extraction: {
      rows: [
        { rawTeamName: 'Unknown Squad', placement: 1, kills: 8, totalPoints: 20 }
      ]
    }
  });

  const row = result.normalizedDraft.teamResults[0];
  assert.equal(row.registrationId, null);
  assert.equal(row.matchConfidence, 'unmatched');
  assert.ok(row.warnings.includes('Select the verified registration before saving.'));
});

test('flags small low-resolution images while preserving parsed rows', () => {
  const result = normalizeFreeFireScoreboard({
    input: { lobbyNumber: 1, matchNumber: 1 },
    registrations: [{ _id: '64f000000000000000000001', teamName: 'Team Alpha', status: 'verified' }],
    extraction: {
      layout: SCOREBOARD_LAYOUTS.MATCH_RESULT,
      imageMetadata: { width: 447, height: 447 },
      rows: [
        { rawTeamName: 'Alpha', placement: 1, kills: 8, placementPoints: 12, killPoints: 8, totalPoints: 20 }
      ]
    }
  });

  assert.equal(result.reasonCode, '');
  assert.match(result.warnings.join(' '), /IMAGE_TOO_LOW_RESOLUTION/);
  assert.equal(result.normalizedDraft.teamResults.length, 1);
});

test('detects unsupported Free Fire tournament aggregate scoreboard layout', () => {
  const result = normalizeFreeFireScoreboard({
    input: { lobbyNumber: 1, matchNumber: 1 },
    registrations: [],
    extraction: {
      detectedText: ['Rank', 'Team Name', 'Game 1', 'Game 2', 'Game 3', 'Game 4', 'Game 5', 'Total Points'],
      headers: ['Rank Team Name Game 1 Game 2 Game 3 Game 4 Game 5 Total Points'],
      rows: []
    }
  });

  assert.equal(result.layout, SCOREBOARD_LAYOUTS.TOURNAMENT_AGGREGATE);
  assert.equal(result.reasonCode, INGESTION_FAILURE_REASONS.UNSUPPORTED_SCOREBOARD_LAYOUT);
  assert.equal(result.normalizedDraft.teamResults.length, 0);
  assert.match(result.warnings.join(' '), /Tournament aggregate scoreboard detected/);
});

test('distinguishes zero OCR text from parser no-row cases', () => {
  const noText = normalizeFreeFireScoreboard({
    input: { lobbyNumber: 1, matchNumber: 1 },
    registrations: [],
    extraction: { detectedText: [], rows: [] }
  });

  const parserNoRows = normalizeFreeFireScoreboard({
    input: { lobbyNumber: 1, matchNumber: 1 },
    registrations: [],
    extraction: { detectedText: ['Team Alpha', 'some visible scoreboard text'], rows: [] }
  });

  assert.equal(noText.reasonCode, INGESTION_FAILURE_REASONS.NO_TEXT_DETECTED);
  assert.equal(parserNoRows.reasonCode, INGESTION_FAILURE_REASONS.NO_SUPPORTED_ROWS_DETECTED);
});
