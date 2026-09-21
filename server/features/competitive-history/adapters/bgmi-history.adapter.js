const BGMIMatch = require('../../../models/BGMIMatch');
const BGMILeaderboard = require('../../../models/BGMILeaderboard');
const Team = require('../../../models/Team');
const { CONFIDENCE } = require('../competitive-history.constants');
const { sortNewestFirst, toId } = require('../competitive-history.utils');

const buildTeamLookup = (teams) => new Map(
  teams.map((team) => [toId(team), team.name || ''])
);

const getPlayerBgmiTeamIds = async ({ user, models = {} }) => {
  const TeamModel = models.Team || Team;
  const teams = await TeamModel.find({
    game: 'bgmi',
    isActive: true,
    $or: [
      { captain: user._id },
      { 'members.userId': user._id }
    ]
  })
    .select('name')
    .lean();

  return {
    teamIds: teams.map((team) => toId(team)).filter(Boolean),
    teamLookup: buildTeamLookup(teams)
  };
};

const normalizeMatchResult = ({ match, teamResult, teamName }) => ({
  id: `bgmi-match-${toId(match)}-${toId(teamResult.teamId)}`,
  source: {
    type: 'bgmi_match',
    id: toId(match)
  },
  level: 'match',
  gameType: 'bgmi',
  tournament: match.tournamentId ? {
    id: toId(match.tournamentId),
    name: match.tournamentId.name || ''
  } : null,
  team: {
    entityType: 'team',
    entityId: toId(teamResult.teamId),
    name: teamResult.teamName || teamName || ''
  },
  occurredAt: match.endTime || match.startTime || match.scheduledTime || match.updatedAt || match.createdAt,
  status: teamResult.verified ? 'verified' : 'submitted',
  confidence: teamResult.verified ? CONFIDENCE.VERIFIED_RESULT : CONFIDENCE.DERIVED,
  result: {
    type: 'placement',
    data: {
      placement: teamResult.placement,
      kills: teamResult.kills,
      points: teamResult.points,
      verified: Boolean(teamResult.verified)
    }
  }
});

const normalizeLeaderboardHistory = ({ entry, history, tournamentName }) => ({
  id: `bgmi-leaderboard-${toId(entry.tournamentId)}-${toId(entry.teamId)}-${history.matchNumber}`,
  source: {
    type: 'bgmi_leaderboard',
    id: toId(entry)
  },
  level: 'match',
  gameType: 'bgmi',
  tournament: {
    id: toId(entry.tournamentId),
    name: tournamentName || ''
  },
  team: {
    entityType: 'team',
    entityId: toId(entry.teamId),
    name: entry.teamName || ''
  },
  occurredAt: history.playedAt || entry.lastUpdated || entry.updatedAt,
  status: 'verified',
  confidence: CONFIDENCE.VERIFIED_RESULT,
  result: {
    type: 'placement',
    data: {
      placement: history.placement,
      kills: history.kills,
      points: history.points,
      verified: true
    }
  }
});

const getBgmiHistory = async ({ user, limit, models = {} }) => {
  const MatchModel = models.BGMIMatch || BGMIMatch;
  const LeaderboardModel = models.BGMILeaderboard || BGMILeaderboard;
  const { teamIds, teamLookup } = await getPlayerBgmiTeamIds({ user, models });

  if (teamIds.length === 0) return [];

  const queryLimit = Math.max(limit * 2, limit);

  const [matches, leaderboardEntries] = await Promise.all([
    MatchModel.find({
      'teamResults.teamId': { $in: teamIds },
      status: 'completed'
    })
      .sort({ endTime: -1, scheduledTime: -1, createdAt: -1 })
      .limit(queryLimit)
      .select('tournamentId matchNumber scheduledTime startTime endTime status teamResults.teamId teamResults.teamName teamResults.placement teamResults.kills teamResults.points teamResults.verified createdAt updatedAt')
      .populate('tournamentId', 'name')
      .lean(),
    LeaderboardModel.find({ teamId: { $in: teamIds } })
      .sort({ lastUpdated: -1, updatedAt: -1 })
      .limit(queryLimit)
      .select('tournamentId teamId teamName matchHistory lastUpdated updatedAt')
      .populate('tournamentId', 'name')
      .lean()
  ]);

  const matchEvents = matches.flatMap((match) => (
    (match.teamResults || [])
      .filter((teamResult) => teamIds.includes(toId(teamResult.teamId)))
      .map((teamResult) => normalizeMatchResult({
        match,
        teamResult,
        teamName: teamLookup.get(toId(teamResult.teamId))
      }))
  ));

  const matchEventKeys = new Set(matchEvents.map((event) => {
    const matchNumber = matches.find((match) => event.source.id === toId(match))?.matchNumber;
    return `${event.tournament?.id}:${event.team?.entityId}:${matchNumber}`;
  }));

  const leaderboardEvents = leaderboardEntries.flatMap((entry) => {
    const tournamentName = entry.tournamentId?.name || '';
    const tournamentId = toId(entry.tournamentId);
    const teamId = toId(entry.teamId);

    return (entry.matchHistory || [])
      .filter((history) => !matchEventKeys.has(`${tournamentId}:${teamId}:${history.matchNumber}`))
      .map((history) => normalizeLeaderboardHistory({ entry, history, tournamentName }));
  });

  return sortNewestFirst([...matchEvents, ...leaderboardEvents]).slice(0, limit);
};

module.exports = {
  getBgmiHistory,
  getPlayerBgmiTeamIds,
  normalizeLeaderboardHistory,
  normalizeMatchResult
};
