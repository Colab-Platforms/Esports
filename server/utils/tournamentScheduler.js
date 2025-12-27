const Tournament = require('../models/Tournament');

class TournamentScheduler {
  constructor() {
    this.intervalId = null;
    this.isRunning = false;
  }

  start() {
    if (this.isRunning) {
      console.log('🔄 Tournament scheduler is already running');
      return;
    }

    console.log('🚀 Starting tournament status scheduler...');
    this.isRunning = true;

    // Run immediately on start
    this.updateTournamentStatuses();

    // Then run every 10 minutes
    this.intervalId = setInterval(() => {
      this.updateTournamentStatuses();
    }, 10 * 60 * 1000); // 10 minutes

    console.log('✅ Tournament scheduler started - will check every 10 minutes');
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('🛑 Tournament scheduler stopped');
  }

  async updateTournamentStatuses() {
    try {
      console.log('🔄 Running scheduled tournament status update...');
      const result = await Tournament.updateTournamentStatuses();
      
      if (result.success && result.updatedCount > 0) {
        console.log(`✅ Scheduled update: ${result.updatedCount} tournaments updated`);
      }
    } catch (error) {
      console.error('❌ Scheduled tournament status update failed:', error);
    }
  }
}

// Create singleton instance
const tournamentScheduler = new TournamentScheduler();

module.exports = tournamentScheduler;