#!/usr/bin/env node

const mongoose = require('mongoose');
const CS2LogProcessor = require('../server/services/cs2LogProcessor');
require('dotenv').config();

async function processAllServers() {
  try {
    console.log(`[CRON ${new Date().toISOString()}] Starting CS2 Multi-Server log processing...`);
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/colab-esports');
    console.log('[CRON] Connected to MongoDB');
    
    // Initialize processor
    const processor = new CS2LogProcessor();
    
    // Define servers to process (add more server IDs as needed)
    const servers = [1, 2]; // Add 3, 4, 5... for more servers
    const results = [];
    
    // Process each server sequentially to avoid database conflicts
    for (const serverId of servers) {
      try {
        console.log(`[CRON] Processing Server ${serverId}...`);
        const result = await processor.processLogs(serverId);
        
        if (result.success) {
          console.log(`[CRON] ✅ Server ${serverId}: ${result.processed} new entries, ${result.duplicates} duplicates skipped`);
          results.push({ 
            serverId, 
            status: 'success', 
            processed: result.processed,
            duplicates: result.duplicates 
          });
        } else {
          console.error(`[CRON] ❌ Server ${serverId}: ${result.error}`);
          results.push({ serverId, status: 'error', error: result.error });
        }
        
        // Small delay between servers to prevent database overload
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`[CRON] Error processing Server ${serverId}:`, error.message);
        results.push({ serverId, status: 'error', error: error.message });
      }
    }
    
    // Summary
    const successful = results.filter(r => r.status === 'success').length;
    const failed = results.filter(r => r.status === 'error').length;
    const totalProcessed = results.reduce((sum, r) => sum + (r.processed || 0), 0);
    const totalDuplicates = results.reduce((sum, r) => sum + (r.duplicates || 0), 0);
    
    console.log(`[CRON] 📊 Summary: ${successful} successful, ${failed} failed, ${totalProcessed} total entries processed, ${totalDuplicates} duplicates skipped`);
    
    // Log individual results
    results.forEach(result => {
      if (result.status === 'success') {
        console.log(`[CRON] Server ${result.serverId}: ✅ ${result.processed} processed, ${result.duplicates} duplicates`);
      } else {
        console.log(`[CRON] Server ${result.serverId}: ❌ ${result.error}`);
      }
    });
    
  } catch (error) {
    console.error('[CRON] Error in multi-server processing:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log(`[CRON ${new Date().toISOString()}] Multi-server processing completed`);
    process.exit(0);
  }
}

processAllServers();