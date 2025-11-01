const Leaderboard = require('../models/Leaderboard');
const Match = require('../models/Match');
const Tournament = require('../models/Tournament');

class LeaderboardService {
  /**
   * Update leaderboards after a match is completed
   * @param {Object} match - The completed match
   */
  static async updateLeaderboardsFromMatch(match) {
    try {
      console.log(`📊 Updating leaderboards for match ${match._id}`);
      
      const promises = [];
      
      // Process each participant's result
      for (const participant of match.participants) {
        if (participant.resultSubmittedAt) {
          const matchResult = {
            kills: participant.kills,
            deaths: participant.deaths,
            assists: participant.assists,
            finalPosition: participant.finalPosition,
            score: participant.score
          };
          
          // Update overall leaderboard
          promises.push(
            Leaderboard.createOrUpdate(
              participant.userId,
              match.gameType,
              'overall',
              matchResult
            )
          );
          
          // Update monthly leaderboard
          promises.push(
            Leaderboard.createOrUpdate(
              participant.userId,
              match.gameType,
              'monthly',
              matchResult
            )
          );
          
          // Update weekly leaderboard
          promises.push(
            Leaderboard.createOrUpdate(
              participant.userId,
              match.gameType,
              'weekly',
              matchResult
            )
          );
          
          // Update tournament-specific leaderboard if applicable
          if (match.tournamentId) {
            promises.push(
              Leaderboard.createOrUpdate(
                participant.userId,
                match.gameType,
                'tournament',
                matchResult,
                match.tournamentId
              )
            );
          }
        }
      }
      
      // Wait for all leaderboard updates to complete
      await Promise.all(promises);
      
      // Update rankings for all leaderboard types
      await this.updateAllRankings(match.gameType, match.tournamentId);
      
      console.log(`✅ Leaderboards updated successfully for match ${match._id}`);
    } catch (error) {
      console.error('❌ Error updating leaderboards:', error);
      throw error;
    }
  }
  
  /**
   * Update rankings for all leaderboard types
   * @param {string} gameType - Game type
   * @param {string} tournamentId - Tournament ID (optional)
   */
  static async updateAllRankings(gameType, tournamentId = null) {
    try {
      const rankingPromises = [
        Leaderboard.updateRankings(gameType, 'overall'),
        Leaderboard.updateRankings(gameType, 'monthly'),
        Leaderboard.updateRankings(gameType, 'weekly')
      ];
      
      if (tournamentId) {
        rankingPromises.push(
          Leaderboard.updateRankings(gameType, 'tournament', tournamentId)
        );
      }
      
      await Promise.all(rankingPromises);
      console.log(`📈 Rankings updated for ${gameType}`);
    } catch (error) {
      console.error('❌ Error updating rankings:', error);
      throw error;
    }
  }
  
  /**
   * Get leaderboard data with filters
   * @param {Object} options - Filter options
   */
  static async getLeaderboard(options = {}) {
    try {
      const {
        gameType = 'bgmi',
        leaderboardType = 'overall',
        tournamentId,
        page = 1,
        limit = 50
      } = options;
      
      const skip = (page - 1) * limit;
      
      const leaderboardOptions = {
        gameType,
        leaderboardType,
        tournamentId,
        limit: parseInt(limit),
        skip: parseInt(skip)
      };
      
      // Add period for time-based leaderboards
      if (leaderboardType === 'monthly' || leaderboardType === 'weekly') {
        const now = new Date();
        leaderboardOptions.period = {
          year: now.getFullYear()
        };
        
        if (leaderboardType === 'monthly') {
          leaderboardOptions.period.month = now.getMonth() + 1;
        } else if (leaderboardType === 'weekly') {
          leaderboardOptions.period.week = this.getWeekNumber(now);
        }
      }
      
      const leaderboard = await Leaderboard.getLeaderboard(leaderboardOptions);
      
      // Get total count for pagination
      const totalQuery = {
        gameType,
        leaderboardType,
        isActive: true
      };
      
      if (tournamentId) {
        totalQuery.tournamentId = tournamentId;
      }
      
      if (leaderboardOptions.period) {
        if (leaderboardOptions.period.year) {
          totalQuery['period.year'] = leaderboardOptions.period.year;
        }
        if (leaderboardOptions.period.month) {
          totalQuery['period.month'] = leaderboardOptions.period.month;
        }
        if (leaderboardOptions.period.week) {
          totalQuery['period.week'] = leaderboardOptions.period.week;
        }
      }
      
      const total = await Leaderboard.countDocuments(totalQuery);
      
      return {
        leaderboard,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      console.error('❌ Error getting leaderboard:', error);
      throw error;
    }
  }
  
  /**
   * Get user's position in leaderboard
   * @param {string} userId - User ID
   * @param {string} gameType - Game type
   * @param {string} leaderboardType - Leaderboard type
   * @param {string} tournamentId - Tournament ID (optional)
   */
  static async getUserPosition(userId, gameType, leaderboardType = 'overall', tournamentId = null) {
    try {
      const query = {
        userId,
        gameType,
        leaderboardType,
        isActive: true
      };
      
      if (tournamentId) {
        query.tournamentId = tournamentId;
      }
      
      // Add period for time-based leaderboards
      if (leaderboardType === 'monthly' || leaderboardType === 'weekly') {
        const now = new Date();
        query['period.year'] = now.getFullYear();
        
        if (leaderboardType === 'monthly') {
          query['period.month'] = now.getMonth() + 1;
        } else if (leaderboardType === 'weekly') {
          query['period.week'] = this.getWeekNumber(now);
        }
      }
      
      const userEntry = await Leaderboard.findOne(query)
        .populate('userId', 'username avatarUrl');
      
      return userEntry;
    } catch (error) {
      console.error('❌ Error getting user position:', error);
      throw error;
    }
  }
  
  /**
   * Get top performers for a specific period
   * @param {Object} options - Filter options
   */
  static async getTopPerformers(options = {}) {
    try {
      const {
        gameType = 'bgmi',
        leaderboardType = 'overall',
        limit = 10
      } = options;
      
      const leaderboard = await this.getLeaderboard({
        gameType,
        leaderboardType,
        limit
      });
      
      return leaderboard.leaderboard.map(entry => ({
        rank: entry.rank,
        user: entry.userId,
        stats: entry.stats,
        points: entry.points,
        rankChange: entry.rankChange
      }));
    } catch (error) {
      console.error('❌ Error getting top performers:', error);
      throw error;
    }
  }
  
  /**
   * Initialize leaderboards for existing matches (one-time setup)
   */
  static async initializeLeaderboards() {
    try {
      console.log('🔄 Initializing leaderboards from existing matches...');
      
      const matches = await Match.find({ status: 'completed' })
        .populate('participants.userId')
        .populate('tournamentId');
      
      console.log(`📊 Found ${matches.length} completed matches to process`);
      
      for (const match of matches) {
        await this.updateLeaderboardsFromMatch(match);
      }
      
      console.log('✅ Leaderboard initialization completed');
    } catch (error) {
      console.error('❌ Error initializing leaderboards:', error);
      throw error;
    }
  }
  
  /**
   * Clean up old weekly/monthly leaderboards
   * @param {number} monthsToKeep - Number of months to keep
   */
  static async cleanupOldLeaderboards(monthsToKeep = 6) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setMonth(cutoffDate.getMonth() - monthsToKeep);
      
      const result = await Leaderboard.deleteMany({
        leaderboardType: { $in: ['weekly', 'monthly'] },
        'period.year': { $lt: cutoffDate.getFullYear() },
        'period.month': { $lt: cutoffDate.getMonth() + 1 }
      });
      
      console.log(`🧹 Cleaned up ${result.deletedCount} old leaderboard entries`);
      return result.deletedCount;
    } catch (error) {
      console.error('❌ Error cleaning up leaderboards:', error);
      throw error;
    }
  }
  
  /**
   * Get leaderboard statistics
   */
  static async getLeaderboardStats() {
    try {
      const stats = await Leaderboard.aggregate([
        {
          $group: {
            _id: {
              gameType: '$gameType',
              leaderboardType: '$leaderboardType'
            },
            totalEntries: { $sum: 1 },
            activeEntries: {
              $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] }
            },
            totalPoints: { $sum: '$points' },
            averagePoints: { $avg: '$points' }
          }
        },
        {
          $sort: { '_id.gameType': 1, '_id.leaderboardType': 1 }
        }
      ]);
      
      return stats;
    } catch (error) {
      console.error('❌ Error getting leaderboard stats:', error);
      throw error;
    }
  }
  
  /**
   * Helper function to get week number
   * @param {Date} date - Date to get week number for
   */
  static getWeekNumber(date) {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  }
}

module.exports = LeaderboardService;