#!/usr/bin/env node

const mongoose = require('mongoose');
const CS2LogProcessor = require('../server/services/cs2LogProcessor');
require('dotenv').config();

async function processServer2() {
  try {
    console.log(`[CRON ${new Date().toISOString()}] Starting CS2 Server 2 log processing...`);
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/colab-esports');
    console.log('[CRON] Connected to MongoDB');
    
    // Initialize processor
    const processor = new CS2LogProcessor();
    
    // Process Server 2 logs
    const result = await processor.processLogs(2);
    
    if (result.success) {
      console.log(`[CRON] ✅ Server 2 processed: ${result.processed} new entries, ${result.duplicates} duplicates skipped`);
    } else {
      console.error(`[CRON] ❌ Server 2 failed: ${result.error}`);
    }
    
  } catch (error) {
    console.error('[CRON] Error processing Server 2:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log(`[CRON ${new Date().toISOString()}] Server 2 processing completed`);
    process.exit(0);
  }
}

processServer2();