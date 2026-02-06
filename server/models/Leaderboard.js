const mongoose = require('mongoose');

const leaderboardSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },
  gameType: {
    type: String,
    required: [true, 'Game type is required'],
    enum: {
      values: ['bgmi', 'cs2'],
      message: 'Game type must be one of: bgmi, cs2'
    }
  },
  leaderboardType: {
    type: String,
    required: [true, 'Leaderboard type is required'],
    enum: {
      values: ['overall', 'monthly', 'weekly', 'tournament'],
      message: 'Leaderboard type must be one of: overall, monthly, weekly, tournament'
    }
  },
  tournamentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tournament',
    default: null // Only for tournament-specific leaderboards
  },
  period: {
    year: { type: Number, default: null },
    month: { type: Number, default: null }, // 1-12 for monthly leaderboards
    week: { type: Number, default: null }   // Week number for weekly leaderboards
  },
  stats: {
    // Match Statistics
    totalMatches: {
      type: Number,
      default: 0,
      min: 0
    },
    matchesWon: {
      type: Number,
      default: 0,
      min: 0
    },
    matchesLost: {
      type: Number,
      default: 0,
      min: 0
    },
    winRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    
    // Performance Statistics
    totalKills: {
      type: Number,
      default: 0,
      min: 0
    },
    totalDeaths: {
      type: Number,
      default: 0,
      min: 0
    },
    totalAssists: {
      type: Number,
      default: 0,
      min: 0
    },
    kdRatio: {
      type: Number,
      default: 0,
      min: 0
    },
    averageKills: {
      type: Number,
      default: 0,
      min: 0
    },
    averageDeaths: {
      type: Number,
      default: 0,
      min: 0
    },
    
    // Placement Statistics
    averagePosition: {
      type: Number,
      default: 0,
      min: 0
    },
    bestPosition: {
      type: Number,
      default: 0,
      min: 0
    },
    top10Finishes: {
      type: Number,
      default: 0,
      min: 0
    },
    top5Finishes: {
      type: Number,
      default: 0,
      min: 0
    },
    chickenDinners: {
      type: Number,
      default: 0,
      min: 0
    },
    
    // Score and Points
    totalScore: {
      type: Number,
      default: 0,
      min: 0
    },
    averageScore: {
      type: Number,
      default: 0,
      min: 0
    },
    highestScore: {
      type: Number,
      default: 0,
      min: 0
    },
    
    // Tournament Performance
    tournamentsPlayed: {
      type: Number,
      default: 0,
      min: 0
    },
    tournamentsWon: {
      type: Number,
      default: 0,
      min: 0
    },
    totalPrizeWon: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  
  // Calculated ranking position
  rank: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Previous rank for tracking changes
  previousRank: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Rank change indicator
  rankChange: {
    type: String,
    enum: ['up', 'down', 'same', 'new'],
    default: 'new'
  },
  
  // Points used for ranking calculation
  points: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Last updated timestamp
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  
  // Activity status
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound indexes for efficient queries
leaderboardSchema.index({ gameType: 1, leaderboardType: 1, rank: 1 });
leaderboardSchema.index({ userId: 1, gameType: 1, leaderboardType: 1 });
leaderboardSchema.index({ tournamentId: 1, rank: 1 });
leaderboardSchema.index({ 'period.year': 1, 'period.month': 1, gameType: 1 });
leaderboardSchema.index({ 'period.year': 1, 'period.week': 1, gameType: 1 });
leaderboardSchema.index({ points: -1, gameType: 1, leaderboardType: 1 });
leaderboardSchema.index({ lastUpdated: 1 });

// Virtual for games played
leaderboardSchema.virtual('gamesPlayed').get(function() {
  return this.stats.totalMatches;
});

// Virtual for kill/death ratio
leaderboardSchema.virtual('kd').get(function() {
  return this.stats.totalDeaths > 0 ? 
    (this.stats.totalKills / this.stats.totalDeaths).toFixed(2) : 
    this.stats.totalKills.toFixed(2);
});

// Virtual for win percentage
leaderboardSchema.virtual('winPercentage').get(function() {
  return this.stats.totalMatches > 0 ? 
    ((this.stats.matchesWon / this.stats.totalMatches) * 100).toFixed(1) : 
    '0.0';
});

// Method to calculate points based on performance
leaderboardSchema.methods.calculatePoints = function() {
  const stats = this.stats;
  
  // Base points calculation formula
  let points = 0;
  
  // Match performance points
  points += stats.matchesWon * 100; // 100 points per win
  points += stats.totalKills * 10;  // 10 points per kill
  points += stats.totalAssists * 5; // 5 points per assist
  points += stats.chickenDinners * 500; // 500 bonus for wins
  points += stats.top5Finishes * 50; // 50 points for top 5
  points += stats.top10Finishes * 25; // 25 points for top 10
  
  // Deduct points for deaths
  points -= stats.totalDeaths * 2; // -2 points per death
  
  // Bonus for consistency (high average score)
  if (stats.averageScore > 500) {
    points += (stats.averageScore - 500) * 0.5;
  }
  
  // Tournament performance bonus
  points += stats.tournamentsWon * 1000; // 1000 points per tournament win
  points += stats.totalPrizeWon * 0.1; // 0.1 points per rupee won
  
  // Ensure points are not negative
  this.points = Math.max(0, Math.round(points));
  
  return this.points;
};

// Method to update stats from match result
leaderboardSchema.methods.updateFromMatch = function(matchResult) {
  const stats = this.stats;
  
  // Update match counts
  stats.totalMatches += 1;
  
  if (matchResult.finalPosition === 1) {
    stats.matchesWon += 1;
    stats.chickenDinners += 1;
  } else {
    stats.matchesLost += 1;
  }
  
  // Update kill/death/assist stats
  stats.totalKills += matchResult.kills || 0;
  stats.totalDeaths += matchResult.deaths || 0;
  stats.totalAssists += matchResult.assists || 0;
  
  // Update placement stats
  if (matchResult.finalPosition <= 10) {
    stats.top10Finishes += 1;
  }
  if (matchResult.finalPosition <= 5) {
    stats.top5Finishes += 1;
  }
  
  // Update best position
  if (stats.bestPosition === 0 || matchResult.finalPosition < stats.bestPosition) {
    stats.bestPosition = matchResult.finalPosition;
  }
  
  // Update score stats
  const matchScore = matchResult.score || 0;
  stats.totalScore += matchScore;
  
  if (matchScore > stats.highestScore) {
    stats.highestScore = matchScore;
  }
  
  // Recalculate averages
  stats.averageKills = stats.totalMatches > 0 ? stats.totalKills / stats.totalMatches : 0;
  stats.averageDeaths = stats.totalMatches > 0 ? stats.totalDeaths / stats.totalMatches : 0;
  stats.averageScore = stats.totalMatches > 0 ? stats.totalScore / stats.totalMatches : 0;
  stats.kdRatio = stats.totalDeaths > 0 ? stats.totalKills / stats.totalDeaths : stats.totalKills;
  stats.winRate = stats.totalMatches > 0 ? (stats.matchesWon / stats.totalMatches) * 100 : 0;
  
  // Calculate average position (weighted)
  const currentAvg = stats.averagePosition || 50; // Default to middle position
  stats.averagePosition = ((currentAvg * (stats.totalMatches - 1)) + matchResult.finalPosition) / stats.totalMatches;
  
  // Recalculate points
  this.calculatePoints();
  
  // Update timestamp
  this.lastUpdated = new Date();
  
  return this.save();
};

// Static method to get leaderboard with pagination
leaderboardSchema.statics.getLeaderboard = async function(options = {}) {
  const {
    gameType,
    leaderboardType = 'overall',
    tournamentId,
    limit = 50,
    skip = 0,
    period
  } = options;
  
  // Generate cache key
  const cacheKey = `leaderboard:${gameType}:${leaderboardType}:${tournamentId || 'all'}:${skip}:${limit}`;
  
  // Try to get from Redis cache first
  try {
    const redisService = require('../services/redisService');
    const cached = await redisService.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (err) {
    console.warn('Redis cache miss, querying database');
  }
  
  const query = {
    gameType,
    leaderboardType,
    isActive: true,
    userId: { $ne: null, $exists: true }
  };
  
  if (tournamentId) {
    query.tournamentId = tournamentId;
  }
  
  if (period) {
    if (period.year) query['period.year'] = period.year;
    if (period.month) query['period.month'] = period.month;
    if (period.week) query['period.week'] = period.week;
  }
  
  // Use lean() for read-only queries - much faster
  const results = await this.find(query)
    .populate('userId', 'username avatarUrl gameIds')
    .populate('tournamentId', 'name')
    .sort({ points: -1, 'stats.totalScore': -1 })
    .limit(limit)
    .skip(skip)
    .lean()
    .exec();
  
  // Cache for 5 minutes
  try {
    const redisService = require('../services/redisService');
    await redisService.set(cacheKey, results, 300);
  } catch (err) {
    console.warn('Failed to cache leaderboard');
  }
  
  return results;
};

// Static method to update rankings
leaderboardSchema.statics.updateRankings = async function(gameType, leaderboardType, tournamentId = null) {
  const query = {
    gameType,
    leaderboardType,
    isActive: true
  };
  
  if (tournamentId) {
    query.tournamentId = tournamentId;
  }
  
  const leaderboards = await this.find(query)
    .sort({ points: -1, 'stats.totalScore': -1 })
    .lean();
  
  const bulkOps = leaderboards.map((entry, index) => {
    const newRank = index + 1;
    const previousRank = entry.rank || 0;
    
    let rankChange = 'same';
    if (previousRank === 0) {
      rankChange = 'new';
    } else if (newRank < previousRank) {
      rankChange = 'up';
    } else if (newRank > previousRank) {
      rankChange = 'down';
    }
    
    return {
      updateOne: {
        filter: { _id: entry._id },
        update: {
          $set: {
            previousRank: previousRank,
            rank: newRank,
            rankChange: rankChange,
            lastUpdated: new Date()
          }
        }
      }
    };
  });
  
  if (bulkOps.length > 0) {
    await this.bulkWrite(bulkOps);
  }
  
  return leaderboards.length;
};

// Static method to create or update leaderboard entry
leaderboardSchema.statics.createOrUpdate = async function(userId, gameType, leaderboardType, matchResult, tournamentId = null) {
  const query = {
    userId,
    gameType,
    leaderboardType
  };
  
  if (tournamentId) {
    query.tournamentId = tournamentId;
  }
  
  // Set period for time-based leaderboards
  const now = new Date();
  if (leaderboardType === 'monthly') {
    query['period.year'] = now.getFullYear();
    query['period.month'] = now.getMonth() + 1;
  } else if (leaderboardType === 'weekly') {
    query['period.year'] = now.getFullYear();
    query['period.week'] = getWeekNumber(now);
  }
  
  let leaderboard = await this.findOne(query);
  
  if (!leaderboard) {
    leaderboard = new this({
      userId,
      gameType,
      leaderboardType,
      tournamentId,
      period: {
        year: leaderboardType !== 'overall' ? now.getFullYear() : null,
        month: leaderboardType === 'monthly' ? now.getMonth() + 1 : null,
        week: leaderboardType === 'weekly' ? getWeekNumber(now) : null
      }
    });
  }
  
  await leaderboard.updateFromMatch(matchResult);
  return leaderboard;
};

// Helper function to get week number
function getWeekNumber(date) {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}

module.exports = mongoose.model('Leaderboard', leaderboardSchema);