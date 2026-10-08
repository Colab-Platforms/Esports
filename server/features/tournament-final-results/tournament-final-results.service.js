const crypto = require('crypto');
const Tournament = require('../../models/Tournament');
const TournamentRegistration = require('../../models/TournamentRegistration');
const BGMIMatch = require('../../models/BGMIMatch');
const FreeFireMatchResult = require('../freefire-results/freefire-match-result.model');
const ValorantMatchResult = require('../valorant-results/valorant-match-result.model');
const TournamentFinalResult = require('./tournament-final-result.model');
const {
  RESULT_STATUSES,
  rosterSnapshotForRegistration,
  toId
} = require('../game-results/game-results.utils');

const ACTIVE_GAMES = ['bgmi', 'freefire', 'valorant'];
const FINAL_STATUSES = {
  UNPUBLISHED: 'unpublished',
  PUBLISHED: 'published',
  NEEDS_REPUBLISH: 'needs_republish',
  VOID: 'void'
};

const responseError = (message, status = 400, code = 'VALIDATION_ERROR') => {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
};

const hashPayload = (payload) => crypto
  .createHash('sha256')
  .update(JSON.stringify(payload))
  .digest('hex');

const loadTournament = async (tournamentId) => {
  const tournament = await Tournament.findById(tournamentId)
    .select('name gameType status startDate endDate scoreboards')
    .lean();
  if (!tournament) throw responseError('Tournament not found', 404, 'TOURNAMENT_NOT_FOUND');
  if (!ACTIVE_GAMES.includes(tournament.gameType)) {
    throw responseError('Final results are available only for active competitive games', 400, 'UNSUPPORTED_GAME_TYPE');
  }
  return tournament;
};

const normalizeEvidence = (tournament) => (tournament.scoreboards || [])
  .filter((scoreboard) => scoreboard.imageUrl)
  .sort((a, b) => (a.order || 0) - (b.order || 0))
  .map((scoreboard) => ({
    imageUrl: scoreboard.imageUrl,
    description: scoreboard.description || 'Official Scoreboard',
    source: 'tournament_scoreboard'
  }));

const teamKey = (entry) => toId(entry.canonicalTeamId || entry.registrationId || entry.teamId);

const ranked = (standings, compare) => standings
  .sort(compare)
  .map((standing, index) => ({ ...standing, rank: index + 1 }));

const publicTeamIdentity = (standing = {}) => ({
  canonicalTeamId: standing.canonicalTeamId || null,
  teamName: standing.teamNameSnapshot || '',
  teamTag: standing.teamTagSnapshot || '',
  teamLogo: standing.teamLogoSnapshot || ''
});

const teamSummary = (standing) => standing ? {
  registrationId: standing.registrationId || null,
  canonicalTeamId: standing.canonicalTeamId || null,
  teamNameSnapshot: standing.teamNameSnapshot || '',
  ...publicTeamIdentity(standing)
} : null;

const podiumFromStandings = (standings, limit = 3) => standings
  .slice(0, limit)
  .map((standing) => ({
    rank: standing.rank,
    registrationId: standing.registrationId || null,
    canonicalTeamId: standing.canonicalTeamId || null,
    teamNameSnapshot: standing.teamNameSnapshot || '',
    ...publicTeamIdentity(standing)
  }));

const publicPodium = (podium = []) => podium.map((entry) => ({
  rank: entry.rank,
  registrationId: entry.registrationId || null,
  canonicalTeamId: entry.canonicalTeamId || null,
  teamNameSnapshot: entry.teamNameSnapshot || '',
  ...publicTeamIdentity(entry)
}));

const publicRosterSnapshot = (rosterSnapshot = []) => rosterSnapshot
  .filter((member) => member && (member.displayName || member.gameId))
  .map((member) => ({
    displayName: member.displayName || '',
    gameId: member.gameId || '',
    role: member.role || ''
  }));

const publicStanding = (standing) => ({
  rank: standing.rank,
  registrationId: standing.registrationId || null,
  canonicalTeamId: standing.canonicalTeamId || null,
  teamNameSnapshot: standing.teamNameSnapshot || '',
  ...publicTeamIdentity(standing),
  rosterSnapshot: publicRosterSnapshot(standing.rosterSnapshot || []),
  matchesPlayed: standing.matchesPlayed ?? null,
  wins: standing.wins ?? null,
  losses: standing.losses ?? null,
  kills: standing.kills ?? null,
  placementPoints: standing.placementPoints ?? null,
  killPoints: standing.killPoints ?? null,
  totalPoints: standing.totalPoints ?? null,
  roundsWon: standing.roundsWon ?? null,
  roundsLost: standing.roundsLost ?? null,
  roundDifference: standing.roundDifference ?? null,
  bestPlacement: standing.bestPlacement || null
});

const optionalNonNegativeNumber = (value, fieldName) => {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw responseError(`${fieldName} must be a non-negative number`);
  }
  return parsed;
};

const validateManualStandingRanks = (manualStandings) => {
  if (!Array.isArray(manualStandings) || manualStandings.length === 0) {
    throw responseError('Manual final standings are required');
  }
  if (manualStandings.length > 10) {
    throw responseError('Manual final standings cannot contain more than 10 teams');
  }

  const cleaned = manualStandings
    .filter((entry) => entry && entry.registrationId)
    .map((entry) => ({
      rank: Number(entry.rank),
      registrationId: toId(entry.registrationId),
      matchesPlayed: optionalNonNegativeNumber(entry.matchesPlayed, 'matchesPlayed'),
      wins: optionalNonNegativeNumber(entry.wins, 'wins'),
      losses: optionalNonNegativeNumber(entry.losses, 'losses'),
      kills: optionalNonNegativeNumber(entry.kills, 'kills'),
      placementPoints: optionalNonNegativeNumber(entry.placementPoints, 'placementPoints'),
      killPoints: optionalNonNegativeNumber(entry.killPoints, 'killPoints'),
      totalPoints: optionalNonNegativeNumber(entry.totalPoints, 'totalPoints'),
      roundsWon: optionalNonNegativeNumber(entry.roundsWon ?? entry.roundsFor, 'roundsFor'),
      roundsLost: optionalNonNegativeNumber(entry.roundsLost ?? entry.roundsAgainst, 'roundsAgainst')
    }));

  if (cleaned.length === 0) throw responseError('At least rank 1 is required');
  if (cleaned.length !== manualStandings.length) {
    throw responseError('Every manual standing requires a registration');
  }

  const seenRanks = new Set();
  const seenRegistrations = new Set();
  cleaned.forEach((entry) => {
    if (!Number.isInteger(entry.rank) || entry.rank < 1 || entry.rank > 10) {
      throw responseError('Manual final ranks must be integers from 1 to 10');
    }
    if (seenRanks.has(entry.rank)) throw responseError('Duplicate manual final rank is not allowed');
    if (seenRegistrations.has(entry.registrationId)) throw responseError('Duplicate manual final team is not allowed');
    seenRanks.add(entry.rank);
    seenRegistrations.add(entry.registrationId);
  });

  const sorted = cleaned.sort((a, b) => a.rank - b.rank);
  sorted.forEach((entry, index) => {
    if (entry.rank !== index + 1) {
      throw responseError('Manual final ranks must be contiguous from rank 1');
    }
  });

  return sorted;
};

const deriveManualPreview = async ({ tournament, evidence, manualStandings }) => {
  const sorted = validateManualStandingRanks(manualStandings);
  const registrationIds = sorted.map((entry) => entry.registrationId);
  const registrations = await TournamentRegistration.find({
    _id: { $in: registrationIds },
    tournamentId: tournament._id
  })
    .select('tournamentId userId teamName teamId status teamLeader teamMembers substitutePlayer roster')
    .lean();

  const registrationsById = new Map(registrations.map((registration) => [toId(registration), registration]));

  const standings = sorted.map((entry) => {
    const registration = registrationsById.get(entry.registrationId);
    if (!registration) {
      throw responseError('Every manual final team must be registered for this tournament');
    }
    if (registration.status !== 'verified') {
      throw responseError('Manual final teams must use verified registrations');
    }

    return {
      rank: entry.rank,
      registrationId: entry.registrationId,
      canonicalTeamId: toId(registration.teamId) || null,
      teamNameSnapshot: registration.teamName || '',
      rosterSnapshot: rosterSnapshotForRegistration(registration, tournament.gameType),
      matchesPlayed: entry.matchesPlayed,
      wins: entry.wins,
      losses: entry.losses,
      kills: entry.kills,
      placementPoints: entry.placementPoints,
      killPoints: entry.killPoints,
      totalPoints: entry.totalPoints,
      roundsWon: entry.roundsWon,
      roundsLost: entry.roundsLost,
      roundDifference: entry.roundsWon !== null && entry.roundsLost !== null
        ? entry.roundsWon - entry.roundsLost
        : null,
      bestPlacement: null
    };
  });

  return buildPreview({
    tournament,
    standings,
    evidence,
    warnings: ['Manual Top 10 standings were selected by an admin from verified tournament registrations.'],
    source: sorted,
    sourceType: 'manual',
    structuredResultsAvailable: standings.length > 0,
    note: 'Manual Top 10 standings selected from verified tournament registrations.'
  });
};

const deriveBgmiPreview = async ({ tournament, evidence }) => {
  const matches = await BGMIMatch.find({
    tournamentId: tournament._id,
    status: 'completed',
    teamResults: { $elemMatch: { verified: true } }
  })
    .select('matchNumber status startTime endTime updatedAt teamResults')
    .lean();

  const byTeam = new Map();
  const source = [];

  matches.forEach((match) => {
    (match.teamResults || [])
      .filter((teamResult) => teamResult.verified === true && teamResult.teamId)
      .forEach((teamResult) => {
        const key = toId(teamResult.teamId);
        if (!byTeam.has(key)) {
          byTeam.set(key, {
            registrationId: null,
            canonicalTeamId: key,
            teamNameSnapshot: teamResult.teamName || '',
            matchesPlayed: 0,
            wins: 0,
            losses: 0,
            kills: 0,
            placementPoints: 0,
            killPoints: 0,
            totalPoints: 0,
            roundsWon: 0,
            roundsLost: 0,
            roundDifference: 0,
            bestPlacement: null
          });
        }
        const standing = byTeam.get(key);
        const kills = Number(teamResult.kills || 0);
        const totalPoints = Number(teamResult.points || 0);
        standing.teamNameSnapshot = standing.teamNameSnapshot || teamResult.teamName || '';
        standing.matchesPlayed += 1;
        standing.wins += Number(teamResult.placement) === 1 ? 1 : 0;
        standing.kills += kills;
        standing.killPoints += kills;
        standing.placementPoints += Math.max(totalPoints - kills, 0);
        standing.totalPoints += totalPoints;
        standing.bestPlacement = standing.bestPlacement === null
          ? teamResult.placement
          : Math.min(standing.bestPlacement, teamResult.placement || standing.bestPlacement);
        source.push({
          id: `${toId(match)}:${key}`,
          updatedAt: match.updatedAt,
          points: totalPoints,
          kills,
          placement: teamResult.placement
        });
      });
  });

  const standings = ranked(Array.from(byTeam.values()), (a, b) => (
    b.totalPoints - a.totalPoints ||
    b.wins - a.wins ||
    b.kills - a.kills ||
    (a.bestPlacement || Number.MAX_SAFE_INTEGER) - (b.bestPlacement || Number.MAX_SAFE_INTEGER) ||
    String(a.canonicalTeamId).localeCompare(String(b.canonicalTeamId))
  ));

  const warnings = [
    'Completeness cannot be proven automatically; admin review is required before publishing.',
    'BGMI standings are derived from verified completed match results, not the BGMI leaderboard cache.'
  ];

  return buildPreview({
    tournament,
    standings,
    evidence,
    warnings,
    source,
    structuredResultsAvailable: standings.length > 0,
    note: standings.length > 0
      ? 'Derived from verified BGMI match results.'
      : 'No verified BGMI match results are available for this tournament.'
  });
};

const deriveFreeFirePreview = async ({ tournament, evidence }) => {
  const results = await FreeFireMatchResult.find({
    tournamentId: tournament._id,
    status: RESULT_STATUSES.VERIFIED
  })
    .select('lobbyNumber matchNumber verifiedAt updatedAt teamResults')
    .lean();

  const byTeam = new Map();
  const source = [];

  results.forEach((result) => {
    (result.teamResults || []).forEach((teamResult) => {
      const key = teamKey(teamResult);
      if (!key) return;
      if (!byTeam.has(key)) {
        byTeam.set(key, {
          registrationId: toId(teamResult.registrationId) || null,
          canonicalTeamId: toId(teamResult.canonicalTeamId) || null,
          teamNameSnapshot: teamResult.teamNameSnapshot || '',
          matchesPlayed: 0,
          wins: 0,
          losses: 0,
          kills: 0,
          placementPoints: 0,
          killPoints: 0,
          totalPoints: 0,
          roundsWon: 0,
          roundsLost: 0,
          roundDifference: 0,
          bestPlacement: null
        });
      }
      const standing = byTeam.get(key);
      standing.matchesPlayed += 1;
      standing.wins += Number(teamResult.placement) === 1 ? 1 : 0;
      standing.kills += Number(teamResult.kills || 0);
      standing.placementPoints += Number(teamResult.placementPoints || 0);
      standing.killPoints += Number(teamResult.killPoints || 0);
      standing.totalPoints += Number(teamResult.totalPoints || 0);
      standing.bestPlacement = standing.bestPlacement === null
        ? teamResult.placement
        : Math.min(standing.bestPlacement, teamResult.placement || standing.bestPlacement);
      source.push({
        id: `${toId(result)}:${key}`,
        updatedAt: result.updatedAt,
        totalPoints: teamResult.totalPoints,
        kills: teamResult.kills,
        placement: teamResult.placement
      });
    });
  });

  const standings = ranked(Array.from(byTeam.values()), (a, b) => (
    b.totalPoints - a.totalPoints ||
    b.wins - a.wins ||
    b.kills - a.kills ||
    (a.bestPlacement || Number.MAX_SAFE_INTEGER) - (b.bestPlacement || Number.MAX_SAFE_INTEGER) ||
    String(a.canonicalTeamId || a.registrationId).localeCompare(String(b.canonicalTeamId || b.registrationId))
  ));

  const warnings = [
    'Completeness cannot be proven automatically; admin review is required before publishing.',
    'Free Fire tie-breaks use total points, wins, kills, best placement, then stable registration/team id because no dedicated tournament tie-break config exists.'
  ];

  return buildPreview({
    tournament,
    standings,
    evidence,
    warnings,
    source,
    structuredResultsAvailable: standings.length > 0,
    note: standings.length > 0
      ? 'Derived from verified Free Fire match results.'
      : 'No verified Free Fire match results are available for this tournament.'
  });
};

const sideToStandingSeed = (side) => ({
  registrationId: toId(side.registrationId) || null,
  canonicalTeamId: toId(side.canonicalTeamId) || null,
  teamNameSnapshot: side.teamNameSnapshot || '',
  matchesPlayed: 0,
  wins: 0,
  losses: 0,
  kills: 0,
  placementPoints: 0,
  killPoints: 0,
  totalPoints: 0,
  roundsWon: 0,
  roundsLost: 0,
  roundDifference: 0,
  bestPlacement: null
});

const deriveValorantPreview = async ({ tournament, evidence, explicitStandings = null }) => {
  const results = await ValorantMatchResult.find({
    tournamentId: tournament._id,
    status: RESULT_STATUSES.VERIFIED
  })
    .select('matchNumber playedAt verifiedAt updatedAt map teamA teamB winnerRegistrationId')
    .sort({ matchNumber: 1 })
    .lean();

  const warnings = ['Completeness cannot be proven automatically; admin review is required before publishing.'];
  let standings = [];
  const source = results.map((result) => ({
    id: toId(result),
    updatedAt: result.updatedAt,
    winnerRegistrationId: toId(result.winnerRegistrationId),
    scoreA: result.teamA?.score,
    scoreB: result.teamB?.score
  }));

  if (explicitStandings) {
    standings = normalizeExplicitValorantStandings({ explicitStandings, results });
  } else if (results.length === 1) {
    const match = results[0];
    const winnerSide = toId(match.winnerRegistrationId) === toId(match.teamA?.registrationId)
      ? match.teamA
      : match.teamB;
    const loserSide = winnerSide === match.teamA ? match.teamB : match.teamA;
    standings = [
      {
        ...sideToStandingSeed(winnerSide),
        rank: 1,
        matchesPlayed: 1,
        wins: 1,
        roundsWon: Number(winnerSide.score || 0),
        roundsLost: Number(loserSide.score || 0),
        roundDifference: Number(winnerSide.score || 0) - Number(loserSide.score || 0)
      },
      {
        ...sideToStandingSeed(loserSide),
        rank: 2,
        matchesPlayed: 1,
        losses: 1,
        roundsWon: Number(loserSide.score || 0),
        roundsLost: Number(winnerSide.score || 0),
        roundDifference: Number(loserSide.score || 0) - Number(winnerSide.score || 0)
      }
    ];
  } else if (results.length > 1) {
    warnings.push('Final-match structure unavailable. Champion requires explicit publication.');
  }

  return buildPreview({
    tournament,
    standings,
    evidence,
    warnings,
    source,
    structuredResultsAvailable: standings.length > 0,
    note: standings.length > 0
      ? 'Valorant standings are based on one verified match or explicit admin publication.'
      : 'Valorant has verified matches, but final-match structure is unavailable.'
  });
};

const normalizeExplicitValorantStandings = ({ explicitStandings, results }) => {
  if (!Array.isArray(explicitStandings) || explicitStandings.length === 0) {
    throw responseError('Valorant final standings are required for ambiguous tournaments');
  }

  const eligible = new Map();
  results.forEach((result) => {
    [result.teamA, result.teamB].forEach((side) => {
      const registrationId = toId(side?.registrationId);
      if (!registrationId || eligible.has(registrationId)) return;
      eligible.set(registrationId, sideToStandingSeed(side));
    });
  });

  const seenRanks = new Set();
  const seenRegistrations = new Set();
  const standings = explicitStandings.map((entry) => {
    const rank = Number(entry.rank);
    const registrationId = toId(entry.registrationId);
    if (!Number.isInteger(rank) || rank < 1) throw responseError('Every Valorant standing requires a positive rank');
    if (seenRanks.has(rank)) throw responseError('Duplicate Valorant final rank is not allowed');
    if (seenRegistrations.has(registrationId)) throw responseError('Duplicate Valorant finalist is not allowed');
    const seed = eligible.get(registrationId);
    if (!seed) throw responseError('Valorant finalist must appear in a verified result for this tournament');
    seenRanks.add(rank);
    seenRegistrations.add(registrationId);
    return { ...seed, rank };
  });

  return standings.sort((a, b) => a.rank - b.rank);
};

const buildPreview = ({ tournament, standings, evidence, warnings, source, sourceType = 'derived', structuredResultsAvailable, note }) => {
  const winner = teamSummary(standings[0]);
  const preview = {
    tournament: normalizeTournament(tournament),
    status: FINAL_STATUSES.UNPUBLISHED,
    source: sourceType,
    winner,
    podium: podiumFromStandings(standings),
    standings,
    evidence,
    warnings,
    coverage: {
      structuredResultsAvailable,
      note
    }
  };
  return {
    ...preview,
    sourceFingerprint: hashPayload({
      tournamentId: toId(tournament),
      gameType: tournament.gameType,
      sourceType,
      source,
      standings
    })
  };
};

const derivePreview = async ({ tournamentId, explicitStandings = null } = {}) => {
  const tournament = await loadTournament(tournamentId);
  const evidence = normalizeEvidence(tournament);

  if (explicitStandings) {
    return deriveManualPreview({ tournament, evidence, manualStandings: explicitStandings });
  }

  if (tournament.gameType === 'bgmi') return deriveBgmiPreview({ tournament, evidence });
  if (tournament.gameType === 'freefire') return deriveFreeFirePreview({ tournament, evidence });
  if (tournament.gameType === 'valorant') {
    return deriveValorantPreview({ tournament, evidence });
  }

  throw responseError('Unsupported game type', 400, 'UNSUPPORTED_GAME_TYPE');
};

const normalizeTournament = (tournament) => ({
  id: toId(tournament),
  name: tournament.name || '',
  gameType: tournament.gameType,
  status: tournament.status || '',
  startDate: tournament.startDate || null,
  endDate: tournament.endDate || null
});

const normalizeFinalResult = (result, tournament) => ({
  id: toId(result),
  tournament: normalizeTournament(tournament || result.tournamentId),
  status: result.status,
  source: result.source || 'derived',
  winner: teamSummary(result.winner),
  podium: publicPodium(result.podium || []),
  standings: (result.standings || []).map(publicStanding),
  evidence: result.evidence || [],
  warnings: result.warnings || [],
  coverage: result.coverage || {
    structuredResultsAvailable: false,
    note: 'Final results not published.'
  },
  publishedAt: result.publishedAt || null,
  updatedAt: result.updatedAt || null
});

const publishFinalResult = async ({ tournamentId, payload = {}, actorId }) => {
  const explicitStandings = payload.standings || payload.valorantStandings || null;
  const preview = await derivePreview({ tournamentId, explicitStandings });

  if (preview.standings.length === 0) {
    throw responseError('No safe final standings are available to publish', 400, 'NO_STANDINGS_AVAILABLE');
  }

  const update = {
    tournamentId,
    gameType: preview.tournament.gameType,
    status: FINAL_STATUSES.PUBLISHED,
    sourceFingerprint: preview.sourceFingerprint,
    source: preview.source || 'derived',
    winner: preview.winner,
    podium: preview.podium,
    standings: preview.standings,
    evidence: preview.evidence,
    warnings: preview.warnings,
    coverage: preview.coverage,
    publishedBy: actorId,
    publishedAt: new Date(),
    voidedBy: null,
    voidedAt: null
  };

  const result = await TournamentFinalResult.findOneAndUpdate(
    { tournamentId },
    { $set: update },
    { upsert: true, new: true, runValidators: true }
  ).lean();

  return normalizeFinalResult(result, preview.tournament);
};

const getResultsDirectory = async ({ gameType, page = 1, limit = 12 } = {}) => {
  if (!gameType || !ACTIVE_GAMES.includes(gameType)) {
    throw responseError('Valid gameType is required', 400, 'UNSUPPORTED_GAME_TYPE');
  }

  const safePage = Math.max(parseInt(page, 10) || 1, 1);
  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 12, 1), 50);
  const skip = (safePage - 1) * safeLimit;
  const statusFilter = { $in: [FINAL_STATUSES.PUBLISHED, FINAL_STATUSES.NEEDS_REPUBLISH] };

  const [total, results] = await Promise.all([
    TournamentFinalResult.countDocuments({ gameType, status: statusFilter }),
    TournamentFinalResult.find({ gameType, status: statusFilter })
      .select('tournamentId gameType status source winner podium standings evidence publishedAt updatedAt')
      .populate('tournamentId', 'name gameType status startDate endDate')
      .sort({ publishedAt: -1, updatedAt: -1, _id: -1 })
      .skip(skip)
      .limit(safeLimit)
      .lean()
  ]);

  const tournaments = results
    .filter((result) => result.tournamentId)
    .map((result) => {
      const evidence = result.evidence || [];
      return {
        id: toId(result.tournamentId),
        tournamentId: toId(result.tournamentId),
        name: result.tournamentId.name || '',
        gameType: result.gameType,
        status: result.tournamentId.status || '',
        resultStatus: result.status,
        source: result.source || 'derived',
        startDate: result.tournamentId.startDate || null,
        endDate: result.tournamentId.endDate || null,
        publishedAt: result.publishedAt || null,
        winner: teamSummary(result.winner),
        podium: publicPodium(result.podium || []),
        topStandings: (result.standings || [])
          .slice()
          .sort((a, b) => (a.rank || 999) - (b.rank || 999))
          .slice(0, 10)
          .map(publicStanding),
        scoreboardAvailable: evidence.length > 0,
        scoreboardCount: evidence.length,
        scoreboardThumbnail: evidence[0]?.imageUrl || '',
        routeTarget: `/tournament/${toId(result.tournamentId)}?tab=results`
      };
    });

  return {
    tournaments,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      pages: Math.ceil(total / safeLimit),
      hasMore: safePage * safeLimit < total
    }
  };
};

const voidFinalResult = async ({ tournamentId, actorId }) => {
  const tournament = await loadTournament(tournamentId);
  const result = await TournamentFinalResult.findOneAndUpdate(
    { tournamentId },
    {
      $set: {
        status: FINAL_STATUSES.VOID,
        voidedBy: actorId,
        voidedAt: new Date()
      }
    },
    { new: true, runValidators: true }
  ).lean();

  if (!result) throw responseError('Published final result not found', 404, 'FINAL_RESULT_NOT_FOUND');
  return normalizeFinalResult(result, tournament);
};

const getPublicFinalResult = async ({ tournamentId }) => {
  const tournament = await loadTournament(tournamentId);
  const result = await TournamentFinalResult.findOne({ tournamentId }).lean();
  const evidence = normalizeEvidence(tournament);

  if (!result || result.status === FINAL_STATUSES.UNPUBLISHED || result.status === FINAL_STATUSES.VOID) {
    return {
      tournament: normalizeTournament(tournament),
      status: result?.status || FINAL_STATUSES.UNPUBLISHED,
      winner: null,
      podium: [],
      standings: [],
      evidence,
      warnings: [],
      coverage: {
        structuredResultsAvailable: false,
        note: evidence.length > 0
          ? 'Structured final standings are not available for this tournament.'
          : 'Final results have not been published for this tournament.'
      },
      source: result?.source || 'derived',
      publishedAt: null
    };
  }

  return normalizeFinalResult(result, tournament);
};

const getAdminFinalResult = async ({ tournamentId }) => {
  const tournament = await loadTournament(tournamentId);
  const result = await TournamentFinalResult.findOne({ tournamentId }).lean();
  if (!result) {
    return {
      tournament: normalizeTournament(tournament),
      status: FINAL_STATUSES.UNPUBLISHED,
      winner: null,
      podium: [],
      standings: [],
      evidence: normalizeEvidence(tournament),
      warnings: [],
      coverage: {
        structuredResultsAvailable: false,
        note: 'Final results have not been published for this tournament.'
      },
      source: 'derived',
      publishedAt: null
    };
  }
  return normalizeFinalResult(result, tournament);
};

const markTournamentFinalResultStale = async (tournamentId) => {
  if (!tournamentId) return null;
  return TournamentFinalResult.findOneAndUpdate(
    { tournamentId, status: FINAL_STATUSES.PUBLISHED },
    { $set: { status: FINAL_STATUSES.NEEDS_REPUBLISH } },
    { new: true }
  ).lean();
};

module.exports = {
  FINAL_STATUSES,
  derivePreview,
  getAdminFinalResult,
  getPublicFinalResult,
  getResultsDirectory,
  markTournamentFinalResultStale,
  normalizeFinalResult,
  publishFinalResult,
  voidFinalResult
};
