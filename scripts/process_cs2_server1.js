#!/usr/bin/env node

const mongoose = require('mongoose');
const CS2LogProcessor = require('../server/services/cs2LogProcessor');
require('dotenv').config();

async function processServer1() {
  try {
    console.log(`[CRON ${new Date().toISOString()}] Starting CS2 Server 1 log processing...`);
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/colab-esports');
    console.log('[CRON] Connected to MongoDB');
    
    // Initialize processor
    const processor = new CS2LogProcessor();
    
    // Process Server 1 logs
    const result = await processor.processLogs(1);
    
    if (result.success) {
      console.log(`[CRON] ✅ Server 1 processed: ${result.processed} new entries, ${result.duplicates} duplicates skipped`);
    } else {
      console.error(`[CRON] ❌ Server 1 failed: ${result.error}`);
    }
    
  } catch (error) {
    console.error('[CRON] Error processing Server 1:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log(`[CRON ${new Date().toISOString()}] Server 1 processing completed`);
    process.exit(0);
  }
}

processServer1();