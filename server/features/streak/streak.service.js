const mongoose = require('mongoose');
const User = require('../../models/User');
const { DEFAULT_TIMEZONE, getDayKey, getPreviousDayKey } = require('./streak.utils');

const normalizeStreakState = (user, updated, todayKey) => ({
  checkedInToday: user?.lastActivityDayKey === todayKey,
  updated,
  activityStreak: user?.activityStreak || 0,
  longestActivityStreak: user?.longestActivityStreak || 0,
  totalActiveDays: user?.totalActiveDays || 0,
  lastActivityDayKey: user?.lastActivityDayKey || null,
  timezone: DEFAULT_TIMEZONE
});

const checkIn = async (userId, now = new Date()) => {
  const todayKey = getDayKey(now);
  const yesterdayKey = getPreviousDayKey(todayKey);
  const objectUserId = new mongoose.Types.ObjectId(userId);

  const updatedUser = await User.findOneAndUpdate(
    {
      _id: objectUserId,
      isActive: true,
      $or: [
        { lastActivityDayKey: { $ne: todayKey } },
        { lastActivityDayKey: { $exists: false } },
        { lastActivityDayKey: null }
      ]
    },
    [
      {
        $set: {
          nextActivityStreak: {
            $cond: [
              { $eq: ['$lastActivityDayKey', yesterdayKey] },
              { $add: [{ $ifNull: ['$activityStreak', 0] }, 1] },
              1
            ]
          }
        }
      },
      {
        $set: {
          activityStreak: '$nextActivityStreak',
          longestActivityStreak: {
            $max: [{ $ifNull: ['$longestActivityStreak', 0] }, '$nextActivityStreak']
          },
          totalActiveDays: { $add: [{ $ifNull: ['$totalActiveDays', 0] }, 1] },
          lastActivityAt: now,
          lastActivityDayKey: todayKey
        }
      },
      { $unset: 'nextActivityStreak' }
    ],
    {
      new: true,
      projection: 'activityStreak longestActivityStreak totalActiveDays lastActivityDayKey'
    }
  ).lean();

  if (updatedUser) {
    return normalizeStreakState(updatedUser, true, todayKey);
  }

  const currentUser = await User.findOne({ _id: objectUserId, isActive: true })
    .select('activityStreak longestActivityStreak totalActiveDays lastActivityDayKey')
    .lean();

  if (!currentUser) {
    const error = new Error('User not found or inactive');
    error.status = 404;
    throw error;
  }

  return normalizeStreakState(currentUser, false, todayKey);
};

const parseLimit = (limit) => {
  const parsed = parseInt(limit, 10);
  if (Number.isNaN(parsed) || parsed < 1) return 10;
  return Math.min(parsed, 50);
};

const buildEffectiveStreakStage = (todayKey, yesterdayKey) => ({
  $addFields: {
    effectiveActivityStreak: {
      $cond: [
        { $in: ['$lastActivityDayKey', [todayKey, yesterdayKey]] },
        { $ifNull: ['$activityStreak', 0] },
        0
      ]
    }
  }
});

const normalizeLeaderboardRow = (row) => ({
  rank: row.rank,
  userId: row._id.toString(),
  username: row.username,
  displayName: row.fullName || row.username,
  avatar: row.avatarUrl || '',
  activityStreak: row.effectiveActivityStreak || 0,
  longestActivityStreak: row.longestActivityStreak || 0,
  totalActiveDays: row.totalActiveDays || 0
});

const getLeaderboard = async (userId, { limit } = {}) => {
  const resolvedLimit = parseLimit(limit);
  const todayKey = getDayKey();
  const yesterdayKey = getPreviousDayKey(todayKey);
  const objectUserId = new mongoose.Types.ObjectId(userId);

  const baseMatch = {
    isActive: true,
    profileVisibility: 'public'
  };
  const activeStreakDayMatch = {
    lastActivityDayKey: {
      $in: [todayKey, yesterdayKey]
    }
  };

  const sortedLeaderboardPipeline = [
    { $match: baseMatch },
    { $match: activeStreakDayMatch },
    buildEffectiveStreakStage(todayKey, yesterdayKey),
    { $match: { effectiveActivityStreak: { $gt: 0 } } },
    {
      $sort: {
        effectiveActivityStreak: -1,
        longestActivityStreak: -1,
        totalActiveDays: -1,
        _id: 1
      }
    }
  ];

  const [leaderboardRows, currentUserRows, currentUserFallback] = await Promise.all([
    User.aggregate([
      ...sortedLeaderboardPipeline,
      { $limit: resolvedLimit },
      {
        $project: {
          username: 1,
          fullName: 1,
          avatarUrl: 1,
          effectiveActivityStreak: 1,
          longestActivityStreak: 1,
          totalActiveDays: 1
        }
      }
    ]),
    User.aggregate([
      { $match: { ...baseMatch, _id: objectUserId } },
      { $match: activeStreakDayMatch },
      buildEffectiveStreakStage(todayKey, yesterdayKey),
      { $match: { effectiveActivityStreak: { $gt: 0 } } },
      { $match: { _id: objectUserId } },
      { $limit: 1 },
      {
        $project: {
          effectiveActivityStreak: 1,
          longestActivityStreak: 1,
          totalActiveDays: 1
        }
      }
    ]),
    User.aggregate([
      { $match: { _id: objectUserId, isActive: true } },
      buildEffectiveStreakStage(todayKey, yesterdayKey),
      {
        $project: {
          effectiveActivityStreak: 1,
          longestActivityStreak: 1,
          totalActiveDays: 1
        }
      }
    ])
  ]);

  const rankedCurrentUser = currentUserRows[0];
  const fallbackCurrentUser = currentUserFallback[0];
  let currentUserRank = null;

  if (rankedCurrentUser?.effectiveActivityStreak > 0) {
    const [rankResult] = await User.aggregate([
      { $match: baseMatch },
      { $match: activeStreakDayMatch },
      buildEffectiveStreakStage(todayKey, yesterdayKey),
      { $match: { effectiveActivityStreak: { $gt: 0 } } },
      {
        $match: {
          $or: [
            { effectiveActivityStreak: { $gt: rankedCurrentUser.effectiveActivityStreak } },
            {
              effectiveActivityStreak: rankedCurrentUser.effectiveActivityStreak,
              longestActivityStreak: { $gt: rankedCurrentUser.longestActivityStreak || 0 }
            },
            {
              effectiveActivityStreak: rankedCurrentUser.effectiveActivityStreak,
              longestActivityStreak: rankedCurrentUser.longestActivityStreak || 0,
              totalActiveDays: { $gt: rankedCurrentUser.totalActiveDays || 0 }
            },
            {
              effectiveActivityStreak: rankedCurrentUser.effectiveActivityStreak,
              longestActivityStreak: rankedCurrentUser.longestActivityStreak || 0,
              totalActiveDays: rankedCurrentUser.totalActiveDays || 0,
              _id: { $lt: objectUserId }
            }
          ]
        }
      },
      { $count: 'ahead' }
    ]);

    currentUserRank = (rankResult?.ahead || 0) + 1;
  }

  return {
    leaderboard: leaderboardRows.map((row, index) => normalizeLeaderboardRow({
      ...row,
      rank: index + 1
    })),
    currentUser: rankedCurrentUser && currentUserRank ? {
      rank: currentUserRank,
      activityStreak: rankedCurrentUser.effectiveActivityStreak || 0,
      longestActivityStreak: rankedCurrentUser.longestActivityStreak || 0,
      totalActiveDays: rankedCurrentUser.totalActiveDays || 0
    } : {
      rank: null,
      activityStreak: fallbackCurrentUser?.effectiveActivityStreak || 0,
      longestActivityStreak: fallbackCurrentUser?.longestActivityStreak || 0,
      totalActiveDays: fallbackCurrentUser?.totalActiveDays || 0
    },
    timezone: DEFAULT_TIMEZONE
  };
};

module.exports = {
  checkIn,
  getLeaderboard,
  parseLimit
};
