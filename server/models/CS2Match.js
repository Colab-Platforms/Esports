const mongoose = require('mongoose');

const cs2MatchSchema = new mongoose.Schema({
  accountid: {
    type: Number,
    required: [true, 'Steam account ID is required'],
    index: true
  },
  team: {
    type: Number,
    required: [true, 'Team is required'],
    enum: [2, 3], // 2 = Terrorist, 3 = Counter-Terrorist
    validate: {
      validator: function(v) {
        return v === 2 || v === 3;
      },
      message: 'Team must be 2 (Terrorist) or 3 (Counter-Terrorist)'
    }
  },
  kills: {
    type: Number,
    default: 0,
    min: [0, 'Kills cannot be negative']
  },
  deaths: {
    type: Number,
    default: 0,
    min: [0, 'Deaths cannot be negative']
  },
  assists: {
    type: Number,
    default: 0,
    min: [0, 'Assists cannot be negative']
  },
  dmg: {
    type: Number,
    default: 0,
    min: [0, 'Damage cannot be negative']
  },
  kdr: {
    type: Number,
    default: 0,
    min: [0, 'KDR cannot be negative']
  },
  mvp: {
    type: Number,
    default: 0,
    min: [0, 'MVP count cannot be negative']
  },
  map: {
    type: String,
    required: [true, 'Map name is required'],
    trim: true,
    index: true
  },
  round_number: {
    type: Number,
    required: [true, 'Round number is required'],
    min: [1, 'Round number must be at least 1'],
    max: [30, 'Round number cannot exceed 30'],
    index: true
  },
  match_id: {
    type: String,
    required: [true, 'Match ID is required'],
    trim: true,
    index: true
  },
  match_number: {
    type: Number,
    required: [true, 'Match number is required'],
    min: [1, 'Match number must be at least 1'],
    index: true
  },
  match_date: {
    type: String,
    required: [true, 'Match date is required'],
    match: /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD format
    index: true
  },
  match_datetime: {
    type: Date,
    required: [true, 'Match datetime is required'],
    index: true
  },
  server_id: {
    type: Number,
    required: [true, 'Server ID is required'],
    min: [1, 'Server ID must be at least 1'],
    index: true
  }
}, {
  timestamps: true,
  collection: 'cs2_matches'
});

// Compound unique index to prevent duplicate entries
// Same player cannot have multiple entries for the same match and round
cs2MatchSchema.index(
  { accountid: 1, match_id: 1, round_number: 1 },
  { unique: true, name: 'unique_player_match_round' }
);

// Additional indexes for common queries
cs2MatchSchema.index({ match_id: 1, round_number: 1 }); // Get all players in a specific round
cs2MatchSchema.index({ accountid: 1, match_date: -1 }); // Get player history
cs2MatchSchema.index({ server_id: 1, match_datetime: -1 }); // Get server match history
cs2MatchSchema.index({ match_number: 1 }); // Get matches by sequential number

// Virtual for K/D ratio display
cs2MatchSchema.virtual('kd_display').get(function() {
  if (this.deaths === 0) {
    return this.kills.toFixed(2);
  }
  return (this.kills / this.deaths).toFixed(2);
});

// Virtual for team name
cs2MatchSchema.virtual('team_name').get(function() {
  return this.team === 2 ? 'Terrorist' : 'Counter-Terrorist';
});

// Static method to get player statistics for a match
cs2MatchSchema.statics.getMatchStats = async function(matchId) {
  return this.aggregate([
    { $match: { match_id: matchId } },
    {
      $group: {
        _id: '$round_number',
        players: {
          $push: {
            accountid: '$accountid',
            team: '$team',
            kills: '$kills',
            deaths: '$deaths',
            assists: '$assists',
            dmg: '$dmg',
            kdr: '$kdr',
            mvp: '$mvp'
          }
        },
        total_kills: { $sum: '$kills' },
        total_deaths: { $sum: '$deaths' },
        avg_kdr: { $avg: '$kdr' }
      }
    },
    { $sort: { _id: 1 } }
  ]);
};

// Static method to get player leaderboard
cs2MatchSchema.statics.getLeaderboard = async function(options = {}) {
  const matchQuery = {};
  
  if (options.serverId) {
    matchQuery.server_id = options.serverId;
  }
  
  if (options.matchId) {
    matchQuery.match_id = options.matchId;
  }
  
  if (options.startDate && options.endDate) {
    matchQuery.match_date = {
      $gte: options.startDate,
      $lte: options.endDate
    };
  }
  
  const limit = options.limit || 100;
  
  return this.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: '$accountid',
        total_kills: { $sum: '$kills' },
        total_deaths: { $sum: '$deaths' },
        total_assists: { $sum: '$assists' },
        total_damage: { $sum: '$dmg' },
        total_mvp: { $sum: '$mvp' },
        rounds_played: { $sum: 1 },
        matches_played: { $addToSet: '$match_id' }
      }
    },
    {
      $project: {
        accountid: '$_id',
        total_kills: 1,
        total_deaths: 1,
        total_assists: 1,
        total_damage: 1,
        total_mvp: 1,
        rounds_played: 1,
        matches_played: { $size: '$matches_played' },
        avg_kills_per_round: {
          $round: [{ $divide: ['$total_kills', '$rounds_played'] }, 2]
        },
        avg_deaths_per_round: {
          $round: [{ $divide: ['$total_deaths', '$rounds_played'] }, 2]
        },
        kdr: {
          $cond: {
            if: { $eq: ['$total_deaths', 0] },
            then: '$total_kills',
            else: { $round: [{ $divide: ['$total_kills', '$total_deaths'] }, 2] }
          }
        }
      }
    },
    { $sort: { total_kills: -1, kdr: -1 } },
    { $limit: limit }
  ]);
};

// Static method to get match summary
cs2MatchSchema.statics.getMatchSummary = async function(matchId) {
  const summary = await this.aggregate([
    { $match: { match_id: matchId } },
    {
      $group: {
        _id: null,
        map: { $first: '$map' },
        match_number: { $first: '$match_number' },
        match_date: { $first: '$match_date' },
        server_id: { $first: '$server_id' },
        total_rounds: { $max: '$round_number' },
        total_kills: { $sum: '$kills' },
        total_deaths: { $sum: '$deaths' },
        total_damage: { $sum: '$dmg' },
        unique_players: { $addToSet: '$accountid' },
        terrorist_rounds: {
          $sum: { $cond: [{ $eq: ['$team', 2] }, 1, 0] }
        },
        ct_rounds: {
          $sum: { $cond: [{ $eq: ['$team', 3] }, 1, 0] }
        }
      }
    },
    {
      $project: {
        _id: 0,
        match_id: matchId,
        map: 1,
        match_number: 1,
        match_date: 1,
        server_id: 1,
        total_rounds: 1,
        total_kills: 1,
        total_deaths: 1,
        total_damage: 1,
        player_count: { $size: '$unique_players' }
      }
    }
  ]);
  
  return summary[0] || null;
};

// Static method to get player match history
cs2MatchSchema.statics.getPlayerHistory = async function(accountId, options = {}) {
  const limit = options.limit || 50;
  
  return this.aggregate([
    { $match: { accountid: accountId } },
    {
      $group: {
        _id: '$match_id',
        match_number: { $first: '$match_number' },
        map: { $first: '$map' },
        match_date: { $first: '$match_date' },
        match_datetime: { $first: '$match_datetime' },
        server_id: { $first: '$server_id' },
        rounds_played: { $sum: 1 },
        total_kills: { $sum: '$kills' },
        total_deaths: { $sum: '$deaths' },
        total_assists: { $sum: '$assists' },
        total_damage: { $sum: '$dmg' },
        total_mvp: { $sum: '$mvp' }
      }
    },
    {
      $project: {
        match_id: '$_id',
        match_number: 1,
        map: 1,
        match_date: 1,
        match_datetime: 1,
        server_id: 1,
        rounds_played: 1,
        total_kills: 1,
        total_deaths: 1,
        total_assists: 1,
        total_damage: 1,
        total_mvp: 1,
        kdr: {
          $cond: {
            if: { $eq: ['$total_deaths', 0] },
            then: '$total_kills',
            else: { $round: [{ $divide: ['$total_kills', '$total_deaths'] }, 2] }
          }
        }
      }
    },
    { $sort: { match_datetime: -1 } },
    { $limit: limit }
  ]);
};

// Instance method to check if this is a winning round
cs2MatchSchema.methods.isWinningRound = async function() {
  // Get all players in this round
  const roundPlayers = await this.constructor.find({
    match_id: this.match_id,
    round_number: this.round_number
  });
  
  // Calculate team kills
  const teamKills = roundPlayers
    .filter(p => p.team === this.team)
    .reduce((sum, p) => sum + p.kills, 0);
  
  const opposingTeamKills = roundPlayers
    .filter(p => p.team !== this.team)
    .reduce((sum, p) => sum + p.kills, 0);
  
  return teamKills > opposingTeamKills;
};

// Pre-save hook to calculate KDR if not provided
cs2MatchSchema.pre('save', function(next) {
  if (this.isModified('kills') || this.isModified('deaths')) {
    if (this.deaths === 0) {
      this.kdr = this.kills;
    } else {
      this.kdr = parseFloat((this.kills / this.deaths).toFixed(2));
    }
  }
  next();
});

// Post-save hook for logging
cs2MatchSchema.post('save', function(doc) {
  console.log(`[CS2Match] Saved: Player ${doc.accountid}, Match #${doc.match_number}, Round ${doc.round_number}, K/D: ${doc.kills}/${doc.deaths}`);
});

// Handle duplicate key errors gracefully
cs2MatchSchema.post('save', function(error, doc, next) {
  if (error.name === 'MongoServerError' && error.code === 11000) {
    next(new Error('Duplicate entry: This player round data already exists'));
  } else {
    next(error);
  }
});

module.exports = mongoose.model('CS2Match', cs2MatchSchema);
