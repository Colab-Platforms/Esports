const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cs2LogProcessor = require('../services/cs2LogProcessor');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const logsDir = path.join(__dirname, '../../logs');
    
    // Create logs directory if it doesn't exist
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
      console.log('[CS2] Created logs directory:', logsDir);
    }
    
    cb(null, logsDir);
  },
  filename: (req, file, cb) => {
    // Get server_id from query parameters (default to 1)
    const serverId = req.query.server_id || 1;
    const filename = `latest_server${serverId}.log`;
    console.log(`[CS2] Saving log file as: ${filename}`);
    cb(null, filename);
  }
});

// File filter to accept only .log files
const fileFilter = (req, file, cb) => {
  // Accept any file (CS2 logs might not have .log extension when uploaded)
  // We'll rely on the filename we set in storage.filename
  cb(null, true);
};

// Configure multer upload
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB max file size
  }
});

/**
 * POST /api/cs2/upload-log
 * Upload CS2 log file from dedicated server
 * Query params: server_id (required)
 * Body: multipart/form-data with 'logfile' field
 */
router.post('/upload-log', upload.single('logfile'), async (req, res) => {
  try {
    // Validate server_id
    const serverId = req.query.server_id;
    if (!serverId) {
      return res.status(400).json({
        success: false,
        error: 'server_id query parameter is required'
      });
    }

    // Validate file upload
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No log file provided. Use "logfile" field in multipart/form-data'
      });
    }

    console.log(`[CS2] Log file uploaded successfully for server ${serverId}`);
    console.log(`[CS2] File path: ${req.file.path}`);
    console.log(`[CS2] File size: ${(req.file.size / 1024).toFixed(2)} KB`);

    // Automatically trigger processing after upload
    console.log(`[CS2] Auto-triggering log processing for server ${serverId}...`);
    const processingResult = await cs2LogProcessor.processLogs(parseInt(serverId, 10));

    if (processingResult.success) {
      return res.status(200).json({
        success: true,
        message: `Log uploaded and processed successfully for server ${serverId}`,
        uploadInfo: {
          filename: req.file.filename,
          size: req.file.size,
          path: req.file.path
        },
        processingResult: {
          inserted: processingResult.inserted,
          skipped: processingResult.skipped,
          map: processingResult.map,
          processedLines: processingResult.processedLines
        }
      });
    } else {
      return res.status(200).json({
        success: true,
        message: `Log uploaded successfully for server ${serverId}, but processing had issues`,
        uploadInfo: {
          filename: req.file.filename,
          size: req.file.size,
          path: req.file.path
        },
        processingResult: processingResult
      });
    }

  } catch (error) {
    console.error('[CS2] Error in upload-log endpoint:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to upload log file',
      details: error.message
    });
  }
});

/**
 * POST /api/cs2/process-logs
 * Manually trigger log processing for a specific server
 * Body: { serverId: number }
 */
router.post('/process-logs', async (req, res) => {
  try {
    const { serverId } = req.body;

    // Validate serverId
    if (!serverId) {
      return res.status(400).json({
        success: false,
        error: 'serverId is required in request body'
      });
    }

    console.log(`[CS2] Manual processing triggered for server ${serverId}`);

    // Process logs
    const result = await cs2LogProcessor.processLogs(parseInt(serverId, 10));

    if (result.success) {
      return res.status(200).json({
        success: true,
        message: `Logs processed successfully for server ${serverId}`,
        result: {
          inserted: result.inserted,
          skipped: result.skipped,
          map: result.map,
          processedLines: result.processedLines,
          totalLines: result.totalLines
        }
      });
    } else {
      return res.status(400).json({
        success: false,
        error: result.error || 'Failed to process logs',
        message: result.message
      });
    }

  } catch (error) {
    console.error('[CS2] Error in process-logs endpoint:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to process logs',
      details: error.message
    });
  }
});

/**
 * GET /api/cs2/server-status/:serverId
 * Get processing status for a specific server
 */
router.get('/server-status/:serverId', (req, res) => {
  try {
    const serverId = parseInt(req.params.serverId, 10);
    const logsDir = path.join(__dirname, '../../logs');
    const logPath = path.join(logsDir, `latest_server${serverId}.log`);
    const checkpointPath = path.join(logsDir, `checkpoint_server${serverId}.txt`);

    // Check if log file exists
    const logExists = fs.existsSync(logPath);
    let logSize = 0;
    let logLines = 0;

    if (logExists) {
      const stats = fs.statSync(logPath);
      logSize = stats.size;
      const content = fs.readFileSync(logPath, 'utf-8');
      logLines = content.split('\n').length;
    }

    // Check checkpoint
    let checkpoint = 0;
    if (fs.existsSync(checkpointPath)) {
      const checkpointContent = fs.readFileSync(checkpointPath, 'utf-8').trim();
      checkpoint = parseInt(checkpointContent, 10) || 0;
    }

    return res.status(200).json({
      success: true,
      serverId: serverId,
      logFile: {
        exists: logExists,
        path: logPath,
        size: logSize,
        sizeKB: (logSize / 1024).toFixed(2),
        totalLines: logLines
      },
      checkpoint: {
        lastProcessedLine: checkpoint,
        pendingLines: Math.max(0, logLines - checkpoint)
      },
      status: logExists ? (checkpoint >= logLines ? 'up-to-date' : 'pending-processing') : 'no-log-file'
    });

  } catch (error) {
    console.error('[CS2] Error in server-status endpoint:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get server status',
      details: error.message
    });
  }
});

/**
 * GET /api/cs2/health
 * Health check endpoint
 */
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'CS2 Log Processing API is running',
    timestamp: new Date().toISOString()
  });
});

/**
 * DELETE /api/cs2/reset-checkpoint/:serverId
 * Reset checkpoint for a server (reprocess all logs)
 */
router.delete('/reset-checkpoint/:serverId', (req, res) => {
  try {
    const serverId = parseInt(req.params.serverId, 10);
    const logsDir = path.join(__dirname, '../../logs');
    const checkpointPath = path.join(logsDir, `checkpoint_server${serverId}.txt`);

    // Delete checkpoint file
    if (fs.existsSync(checkpointPath)) {
      fs.unlinkSync(checkpointPath);
      console.log(`[CS2] Checkpoint reset for server ${serverId}`);
      
      return res.status(200).json({
        success: true,
        message: `Checkpoint reset for server ${serverId}. Next upload will reprocess all logs.`,
        serverId: serverId
      });
    } else {
      return res.status(200).json({
        success: true,
        message: `No checkpoint found for server ${serverId}. Already reset.`,
        serverId: serverId
      });
    }
  } catch (error) {
    console.error('[CS2] Error resetting checkpoint:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to reset checkpoint',
      details: error.message
    });
  }
});

module.exports = router;
