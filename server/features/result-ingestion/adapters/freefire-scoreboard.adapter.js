const {
  CONFIDENCE_LEVELS,
  INGESTION_FAILURE_REASONS,
  SCOREBOARD_LAYOUTS
} = require('../result-ingestion.constants');
const {
  matchConfidence,
  parseNumber,
  safeRows,
  teamNameSimilarity,
  toId
} = require('../result-ingestion.utils');

const EXPECTED_FREEFIRE_MATCH_RESULT_FORMAT = [
  'One row per team for a single Free Fire lobby/match.',
  'Each supported row must include team name, placement/rank, kills, placement points, kill points, and total points.',
  'Tournament aggregate sheets with Game 1..Game N columns are not converted because those values are not safe match-level placement/kills/point breakdowns.'
];

const fieldConfidence = (value, rowConfidence) => {
  if (value === undefined || value === null) return CONFIDENCE_LEVELS.LOW;
  if (typeof rowConfidence === 'number') {
    if (rowConfidence >= 0.85) return CONFIDENCE_LEVELS.HIGH;
    if (rowConfidence >= 0.65) return CONFIDENCE_LEVELS.MEDIUM;
  }
  if (typeof rowConfidence === 'string') return rowConfidence;
  return CONFIDENCE_LEVELS.MEDIUM;
};

const rowConfidenceValue = (confidence) => {
  if (typeof confidence === 'number') return confidence;
  if (confidence && typeof confidence === 'object') {
    const values = Object.values(confidence).filter((value) => typeof value === 'number');
    if (values.length) return values.reduce((sum, value) => sum + value, 0) / values.length;
  }
  return undefined;
};

const candidateForRegistration = (row, registration) => {
  const similarity = teamNameSimilarity(row.rawTeamName, registration.teamName);
  return {
    registrationId: registration._id || registration.id,
    teamName: registration.teamName,
    canonicalTeamId: registration.teamId || null,
    similarity,
    confidence: matchConfidence(similarity)
  };
};

const compactText = (extraction) => [
  ...(Array.isArray(extraction?.headers) ? extraction.headers : []),
  ...(Array.isArray(extraction?.detectedText) ? extraction.detectedText : [])
].join(' ').toLowerCase();

const classifyFreeFireLayout = (extraction, rows) => {
  if (extraction?.layout && Object.values(SCOREBOARD_LAYOUTS).includes(extraction.layout)) {
    return extraction.layout;
  }

  const text = compactText(extraction);
  const gameColumnCount = (text.match(/\bgame\s*\d+\b/g) || []).length;
  if (gameColumnCount >= 2 && text.includes('total') && text.includes('points')) {
    return SCOREBOARD_LAYOUTS.TOURNAMENT_AGGREGATE;
  }

  const hasMatchFields = text.includes('kill') || text.includes('placement') || text.includes('place');
  if (rows.length > 0 && hasMatchFields) return SCOREBOARD_LAYOUTS.MATCH_RESULT;
  if (rows.length > 0) return SCOREBOARD_LAYOUTS.MATCH_RESULT;
  return SCOREBOARD_LAYOUTS.UNKNOWN;
};

const baseDraft = (input) => ({
  lobbyNumber: parseNumber(input?.lobbyNumber) || null,
  matchNumber: parseNumber(input?.matchNumber) || null,
  map: String(input?.map || '').trim(),
  teamResults: []
});

const lowResolutionWarnings = (extraction) => {
  const width = Number(extraction?.imageMetadata?.width || 0);
  const height = Number(extraction?.imageMetadata?.height || 0);
  if (width && height && (width < 600 || height < 400)) {
    return [`${INGESTION_FAILURE_REASONS.IMAGE_TOO_LOW_RESOLUTION}: Image is ${width}x${height}; OCR may be unreliable. Use a higher-resolution scoreboard image when possible.`];
  }
  return [];
};

const normalizeFreeFireScoreboard = ({ extraction, registrations, input }) => {
  const rows = safeRows(extraction?.rows || extraction?.teams || extraction?.data?.rows || []);
  const layout = classifyFreeFireLayout(extraction, rows);
  const detectedText = Array.isArray(extraction?.detectedText) ? extraction.detectedText.filter(Boolean) : [];
  const warnings = [
    ...lowResolutionWarnings(extraction),
    ...(Array.isArray(extraction?.warnings) ? extraction.warnings : [])
  ];
  const verifiedRegistrations = (registrations || []).filter((registration) => registration.status === 'verified');

  if (layout === SCOREBOARD_LAYOUTS.TOURNAMENT_AGGREGATE) {
    return {
      layout,
      reasonCode: INGESTION_FAILURE_REASONS.UNSUPPORTED_SCOREBOARD_LAYOUT,
      normalizedDraft: baseDraft(input),
      warnings: [
        ...warnings,
        `${INGESTION_FAILURE_REASONS.UNSUPPORTED_SCOREBOARD_LAYOUT}: Tournament aggregate scoreboard detected. Use manual entry for individual lobby/match results.`,
        `Expected format: ${EXPECTED_FREEFIRE_MATCH_RESULT_FORMAT.join(' ')}`
      ]
    };
  }

  if (!rows.length) {
    const reasonCode = detectedText.length
      ? INGESTION_FAILURE_REASONS.NO_SUPPORTED_ROWS_DETECTED
      : INGESTION_FAILURE_REASONS.NO_TEXT_DETECTED;
    return {
      layout,
      reasonCode,
      normalizedDraft: baseDraft(input),
      warnings: [
        ...warnings,
        `${reasonCode}: ${detectedText.length ? 'OCR found text but no supported Free Fire match-result rows.' : 'OCR did not detect readable text in the image.'}`,
        `Expected format: ${EXPECTED_FREEFIRE_MATCH_RESULT_FORMAT.join(' ')}`
      ]
    };
  }

  const teamResults = rows.map((row, index) => {
    const confidenceValue = rowConfidenceValue(row.confidence);
    const candidates = verifiedRegistrations
      .map((registration) => candidateForRegistration(row, registration))
      .filter((candidate) => candidate.similarity > 0)
      .sort((left, right) => right.similarity - left.similarity)
      .slice(0, 5);

    const exactCandidates = candidates.filter((candidate) => candidate.similarity === 1);
    const matched = exactCandidates.length === 1 ? exactCandidates[0] : null;
    const rowWarnings = [];

    if (!row.rawTeamName) rowWarnings.push('Team name was not extracted.');
    if (!matched) rowWarnings.push('Select the verified registration before saving.');
    if (exactCandidates.length > 1) rowWarnings.push('Multiple verified registrations matched this team name.');
    if (row.placement === undefined) rowWarnings.push('Placement is missing.');
    if (row.kills === undefined) rowWarnings.push('Kills are missing.');
    if (row.placementPoints === undefined) rowWarnings.push('Placement points are missing.');
    if (row.killPoints === undefined) rowWarnings.push('Kill points are missing.');
    if (row.totalPoints !== undefined && row.placementPoints !== undefined && row.killPoints !== undefined) {
      const computedTotal = row.placementPoints + row.killPoints;
      if (computedTotal !== row.totalPoints) rowWarnings.push('Total points do not match placement points plus kill points.');
    }

    return {
      rowIndex: index,
      rawTeamName: row.rawTeamName,
      registrationId: matched ? toId(matched.registrationId) : null,
      placement: row.placement ?? null,
      kills: row.kills ?? null,
      placementPoints: row.placementPoints ?? null,
      killPoints: row.killPoints ?? null,
      totalPoints: row.totalPoints ?? (
        row.placementPoints !== undefined && row.killPoints !== undefined
          ? row.placementPoints + row.killPoints
          : null
      ),
      matchConfidence: matched ? CONFIDENCE_LEVELS.HIGH : (candidates[0]?.confidence || CONFIDENCE_LEVELS.UNMATCHED),
      fieldConfidence: {
        placement: fieldConfidence(row.placement, confidenceValue),
        kills: fieldConfidence(row.kills, confidenceValue),
        placementPoints: fieldConfidence(row.placementPoints, confidenceValue),
        killPoints: fieldConfidence(row.killPoints, confidenceValue),
        totalPoints: fieldConfidence(row.totalPoints, confidenceValue)
      },
      candidates,
      warnings: rowWarnings
    };
  });

  return {
    layout,
    reasonCode: '',
    normalizedDraft: {
      lobbyNumber: parseNumber(input?.lobbyNumber) || null,
      matchNumber: parseNumber(input?.matchNumber) || null,
      map: String(input?.map || '').trim(),
      teamResults
    },
    warnings: [
      ...warnings,
      ...teamResults.flatMap((row) => row.warnings.map((warning) => `Row ${row.rowIndex + 1}: ${warning}`))
    ]
  };
};

module.exports = {
  EXPECTED_FREEFIRE_MATCH_RESULT_FORMAT,
  classifyFreeFireLayout,
  normalizeFreeFireScoreboard
};
