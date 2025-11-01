const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

class FileUploadService {
  constructor() {
    // Ensure upload directories exist
    this.ensureDirectories();
  }

  /**
   * Ensure upload directories exist
   */
  ensureDirectories() {
    const directories = [
      'uploads',
      'uploads/screenshots',
      'uploads/server-logs',
      'uploads/avatars',
      'uploads/tournament-banners'
    ];

    directories.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  /**
   * Generate unique filename
   * @param {string} originalName - Original filename
   * @param {string} prefix - Prefix for the filename
   * @returns {string} Unique filename
   */
  generateUniqueFilename(originalName, prefix = '') {
    const timestamp = Date.now();
    const randomString = crypto.randomBytes(6).toString('hex');
    const extension = path.extname(originalName);
    const baseName = path.basename(originalName, extension);
    
    return `${prefix}${prefix ? '-' : ''}${baseName}-${timestamp}-${randomString}${extension}`;
  }

  /**
   * Configure multer storage for screenshots
   */
  getScreenshotStorage() {
    return multer.diskStorage({
      destination: (req, file, cb) => {
        cb(null, 'uploads/screenshots/');
      },
      filename: (req, file, cb) => {
        const matchId = req.params.matchId || 'unknown';
        const userId = req.user?.id || 'unknown';
        const filename = this.generateUniqueFilename(file.originalname, `match-${matchId}-user-${userId}`);
        cb(null, filename);
      }
    });
  }

  /**
   * Configure multer storage for server logs
   */
  getServerLogStorage() {
    return multer.diskStorage({
      destination: (req, file, cb) => {
        cb(null, 'uploads/server-logs/');
      },
      filename: (req, file, cb) => {
        const matchId = req.params.matchId || 'unknown';
        const filename = this.generateUniqueFilename(file.originalname, `match-${matchId}-log`);
        cb(null, filename);
      }
    });
  }

  /**
   * Configure multer storage for avatars
   */
  getAvatarStorage() {
    return multer.diskStorage({
      destination: (req, file, cb) => {
        cb(null, 'uploads/avatars/');
      },
      filename: (req, file, cb) => {
        const userId = req.user?.id || 'unknown';
        const filename = this.generateUniqueFilename(file.originalname, `avatar-${userId}`);
        cb(null, filename);
      }
    });
  }

  /**
   * File filter for images
   */
  imageFileFilter(req, file, cb) {
    const allowedMimes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp'
    ];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.'), false);
    }
  }

  /**
   * File filter for log files
   */
  logFileFilter(req, file, cb) {
    const allowedMimes = [
      'text/plain',
      'application/octet-stream',
      'text/log'
    ];

    const allowedExtensions = ['.log', '.txt', '.dem'];
    const fileExtension = path.extname(file.originalname).toLowerCase();

    if (allowedMimes.includes(file.mimetype) || allowedExtensions.includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only log files (.log, .txt, .dem) are allowed.'), false);
    }
  }

  /**
   * Get screenshot upload middleware
   */
  getScreenshotUpload() {
    return multer({
      storage: this.getScreenshotStorage(),
      fileFilter: this.imageFileFilter,
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
        files: 1
      }
    });
  }

  /**
   * Get server log upload middleware
   */
  getServerLogUpload() {
    return multer({
      storage: this.getServerLogStorage(),
      fileFilter: this.logFileFilter,
      limits: {
        fileSize: 50 * 1024 * 1024, // 50MB limit for log files
        files: 1
      }
    });
  }

  /**
   * Get avatar upload middleware
   */
  getAvatarUpload() {
    return multer({
      storage: this.getAvatarStorage(),
      fileFilter: this.imageFileFilter,
      limits: {
        fileSize: 2 * 1024 * 1024, // 2MB limit for avatars
        files: 1
      }
    });
  }

  /**
   * Get multiple screenshots upload middleware
   */
  getMultipleScreenshotsUpload() {
    return multer({
      storage: this.getScreenshotStorage(),
      fileFilter: this.imageFileFilter,
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB per file
        files: 5 // Maximum 5 screenshots
      }
    });
  }

  /**
   * Delete file from filesystem
   * @param {string} filePath - Path to the file to delete
   * @returns {Promise<boolean>} Success status
   */
  async deleteFile(filePath) {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error deleting file:', error);
      return false;
    }
  }

  /**
   * Get file URL for serving
   * @param {string} filename - Filename
   * @param {string} type - File type (screenshot, log, avatar)
   * @returns {string} File URL
   */
  getFileUrl(filename, type) {
    const baseUrl = process.env.BASE_URL || 'http://localhost:5001';
    return `${baseUrl}/uploads/${type}/${filename}`;
  }

  /**
   * Validate file size
   * @param {number} size - File size in bytes
   * @param {number} maxSize - Maximum allowed size in bytes
   * @returns {boolean} Whether file size is valid
   */
  validateFileSize(size, maxSize) {
    return size <= maxSize;
  }

  /**
   * Get file info
   * @param {string} filePath - Path to the file
   * @returns {Object} File information
   */
  getFileInfo(filePath) {
    try {
      const stats = fs.statSync(filePath);
      return {
        exists: true,
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        extension: path.extname(filePath),
        name: path.basename(filePath)
      };
    } catch (error) {
      return {
        exists: false,
        error: error.message
      };
    }
  }

  /**
   * Clean up old files (older than specified days)
   * @param {string} directory - Directory to clean
   * @param {number} daysOld - Files older than this many days will be deleted
   * @returns {Promise<number>} Number of files deleted
   */
  async cleanupOldFiles(directory, daysOld = 30) {
    try {
      const files = fs.readdirSync(directory);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);
      
      let deletedCount = 0;
      
      for (const file of files) {
        const filePath = path.join(directory, file);
        const stats = fs.statSync(filePath);
        
        if (stats.birthtime < cutoffDate) {
          fs.unlinkSync(filePath);
          deletedCount++;
        }
      }
      
      return deletedCount;
    } catch (error) {
      console.error('Error cleaning up old files:', error);
      return 0;
    }
  }

  /**
   * Get storage usage statistics
   * @returns {Object} Storage usage information
   */
  getStorageStats() {
    const directories = [
      'uploads/screenshots',
      'uploads/server-logs',
      'uploads/avatars',
      'uploads/tournament-banners'
    ];

    const stats = {};
    let totalSize = 0;
    let totalFiles = 0;

    directories.forEach(dir => {
      try {
        const files = fs.readdirSync(dir);
        let dirSize = 0;
        
        files.forEach(file => {
          const filePath = path.join(dir, file);
          const fileStats = fs.statSync(filePath);
          dirSize += fileStats.size;
        });

        stats[dir] = {
          files: files.length,
          size: dirSize,
          sizeFormatted: this.formatBytes(dirSize)
        };

        totalSize += dirSize;
        totalFiles += files.length;
      } catch (error) {
        stats[dir] = {
          files: 0,
          size: 0,
          sizeFormatted: '0 B',
          error: error.message
        };
      }
    });

    return {
      directories: stats,
      total: {
        files: totalFiles,
        size: totalSize,
        sizeFormatted: this.formatBytes(totalSize)
      }
    };
  }

  /**
   * Format bytes to human readable format
   * @param {number} bytes - Bytes to format
   * @returns {string} Formatted string
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

module.exports = new FileUploadService();