const cron = require('node-cron');
const cs2LogProcessor = require('../services/cs2LogProcessor');

// Configuration
const CRON_SCHEDULE = '*/5 * * * *'; // Every 5 minutes
const SERVER_IDS = [1]; // Add more server IDs as needed: [1, 2, 3]

/**
 * CS2 Log Processing Cron Job
 * Automatically processes CS2 logs at scheduled intervals
 */
class CS2LogCron {
  constructor() {
    this.isRunning = false;
    this.lastRun = null;
    this.stats = {
      totalRuns: 0,
      successfulRuns: 0,
      failedRuns: 0,
      totalInserted: 0,
      totalSkipped: 0
    };
  }

  /**
   * Start the cron job
   */
  start() {
    console.log('[CS2 CRON] 🚀 Starting CS2 log processing cron job');
    console.log(`[CS2 CRON] ⏰ Schedule: ${CRON_SCHEDULE} (Every 5 minutes)`);
    console.log(`[CS2 CRON] 🖥️ Monitoring servers: ${SERVER_IDS.join(', ')}`);

    // Schedule the cron job
    this.cronJob = cron.schedule(CRON_SCHEDULE, async () => {
      await this.processAllServers();
    });

    console.log('[CS2 CRON] ✅ Cron job started successfully');

    // Run immediately on startup (optional)
    // Uncomment the line below to process logs immediately when server starts
    // setTimeout(() => this.processAllServers(), 5000); // Wait 5 seconds after server start
  }

  /**
   * Process logs for all configured servers
   */
  async processAllServers() {
    // Prevent concurrent runs
    if (this.isRunning) {
      console.log('[CS2 CRON] ⚠️ Previous run still in progress, skipping this cycle');
      return;
    }

    this.isRunning = true;
    this.lastRun = new Date();
    this.stats.totalRuns++;

    console.log('\n' + '='.repeat(60));
    console.log(`[CS2 CRON] 🔄 Starting scheduled log processing...`);
    console.log(`[CS2 CRON] 📅 Time: ${this.lastRun.toLocaleString()}`);
    console.log('='.repeat(60));

    let successCount = 0;
    let failCount = 0;

    // Process each server
    for (const serverId of SERVER_IDS) {
      try {
        console.log(`\n[CS2 CRON] 🖥️ Processing server ${serverId}...`);
        
        const result = await cs2LogProcessor.processLogs(serverId);

        if (result.success) {
          successCount++;
          this.stats.totalInserted += result.inserted || 0;
          this.stats.totalSkipped += result.skipped || 0;

          if (result.inserted > 0) {
            console.log(`[CS2 CRON] ✅ Server ${serverId}: Inserted ${result.inserted}, Skipped ${result.skipped}`);
            console.log(`[CS2 CRON] 🗺️ Map: ${result.map}, Processed Lines: ${result.processedLines}`);
          } else {
            console.log(`[CS2 CRON] ℹ️ Server ${serverId}: No new data to process`);
          }
        } else {
          failCount++;
          console.log(`[CS2 CRON] ❌ Server ${serverId}: ${result.error || result.message}`);
        }

      } catch (error) {
        failCount++;
        console.error(`[CS2 CRON] ❌ Error processing server ${serverId}:`, error.message);
      }
    }

    // Update stats
    if (failCount === 0) {
      this.stats.successfulRuns++;
    } else {
      this.stats.failedRuns++;
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log(`[CS2 CRON] 📊 Processing Summary:`);
    console.log(`[CS2 CRON] ✅ Successful: ${successCount}/${SERVER_IDS.length} servers`);
    if (failCount > 0) {
      console.log(`[CS2 CRON] ❌ Failed: ${failCount}/${SERVER_IDS.length} servers`);
    }
    console.log(`[CS2 CRON] ⏱️ Duration: ${((Date.now() - this.lastRun.getTime()) / 1000).toFixed(2)}s`);
    console.log('='.repeat(60) + '\n');

    this.isRunning = false;
  }

  /**
   * Stop the cron job
   */
  stop() {
    if (this.cronJob) {
      this.cronJob.stop();
      console.log('[CS2 CRON] 🛑 Cron job stopped');
    }
  }

  /**
   * Get cron job statistics
   */
  getStats() {
    return {
      ...this.stats,
      lastRun: this.lastRun,
      isRunning: this.isRunning,
      schedule: CRON_SCHEDULE,
      servers: SERVER_IDS
    };
  }
}

// Create and export singleton instance
const cs2LogCron = new CS2LogCron();

// Start cron job
cs2LogCron.start();

// Export for external control
module.exports = cs2LogCron;
