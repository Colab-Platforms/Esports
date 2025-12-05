const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');

// Check if uploads directory exists and list files
router.get('/uploads', async (req, res) => {
  try {
    const uploadsDir = path.join(__dirname, '../../uploads');
    
    // Check if directory exists
    try {
      await fs.access(uploadsDir);
    } catch (error) {
      return res.json({
        success: false,
        message: 'Uploads directory does not exist',
        path: uploadsDir
      });
    }

    // Read directory contents
    const files = await fs.readdir(uploadsDir);
    
    // Get file details
    const fileDetails = await Promise.all(
      files.map(async (file) => {
        const filePath = path.join(uploadsDir, file);
        const stats = await fs.stat(filePath);
        return {
          name: file,
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime,
          isDirectory: stats.isDirectory()
        };
      })
    );

    res.json({
      success: true,
      uploadsDir,
      totalFiles: files.length,
      files: fileDetails
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Check specific file content (for text files like logs)
router.get('/file/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(__dirname, '../../uploads', filename);
    
    // Check if file exists
    try {
      await fs.access(filePath);
    } catch (error) {
      return res.status(404).json({
        success: false,
        message: 'File not found',
        path: filePath
      });
    }

    // Get file stats
    const stats = await fs.stat(filePath);
    
    // Read file content (only for small files)
    let content = null;
    if (stats.size < 1024 * 1024) { // Less than 1MB
      content = await fs.readFile(filePath, 'utf-8');
    }

    res.json({
      success: true,
      file: {
        name: filename,
        path: filePath,
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        content: content || 'File too large to display'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// System info
router.get('/system', async (req, res) => {
  try {
    const uploadsDir = path.join(__dirname, '../../uploads');
    
    res.json({
      success: true,
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cwd: process.cwd(),
        uploadsDir: uploadsDir
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
