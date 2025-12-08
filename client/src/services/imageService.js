import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';

class ImageService {
  constructor() {
    this.cache = null;
    this.cacheTimestamp = null;
    this.CACHE_DURATION = 30000; // 30 seconds
  }

  // Get auth token from localStorage
  getAuthToken() {
    const token = localStorage.getItem('token');
    return token;
  }

  // Get auth headers
  getAuthHeaders() {
    const token = this.getAuthToken();
    return {
      Authorization: `Bearer ${token}`,
    };
  }

  // Check if cache is valid
  isCacheValid() {
    if (!this.cache || !this.cacheTimestamp) return false;
    return (Date.now() - this.cacheTimestamp) < this.CACHE_DURATION;
  }

  // Clear cache
  clearCache() {
    this.cache = null;
    this.cacheTimestamp = null;
  }

  // Get all site images (with caching)
  async getAllImages(forceRefresh = false) {
    try {
      // Return cached data if valid and not forcing refresh
      if (!forceRefresh && this.isCacheValid()) {
        console.log('📦 Returning cached images');
        return {
          success: true,
          data: this.cache
        };
      }

      console.log('🔄 Fetching fresh images from server');
      const response = await axios.get(`${API_URL}/api/site-images`);
      
      // Update cache
      this.cache = response.data.data.images;
      this.cacheTimestamp = Date.now();
      
      return {
        success: true,
        data: this.cache
      };
    } catch (error) {
      console.error('❌ Error fetching images:', error);
      return {
        success: false,
        error: error.response?.data?.error?.message || 'Failed to fetch images'
      };
    }
  }

  // Get single image by key
  async getImage(key) {
    try {
      const response = await axios.get(`${API_URL}/api/site-images/${key}`);
      return {
        success: true,
        data: response.data.data.image
      };
    } catch (error) {
      console.error(`❌ Error fetching image ${key}:`, error);
      return {
        success: false,
        error: error.response?.data?.error?.message || 'Failed to fetch image'
      };
    }
  }

  // Upload image to Cloudinary
  async uploadToCloudinary(file) {
    try {
      const formData = new FormData();
      formData.append('image', file);

      const response = await axios.post(
        `${API_URL}/api/upload/image`,
        formData,
        {
          headers: {
            ...this.getAuthHeaders(),
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      if (response.data.success) {
        return {
          success: true,
          imageUrl: response.data.data.imageUrl
        };
      } else {
        throw new Error('Upload failed');
      }
    } catch (error) {
      console.error('❌ Cloudinary upload failed:', error);
      // Fallback to Base64
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          resolve({
            success: true,
            imageUrl: reader.result,
            isBase64: true
          });
        };
        reader.onerror = () => {
          resolve({
            success: false,
            error: 'Failed to process image'
          });
        };
        reader.readAsDataURL(file);
      });
    }
  }

  // Update site image
  async updateSiteImage(key, data) {
    try {
      const response = await axios.put(
        `${API_URL}/api/site-images/${key}`,
        data,
        {
          headers: this.getAuthHeaders()
        }
      );

      // Clear cache after update
      this.clearCache();

      return {
        success: true,
        data: response.data.data.image
      };
    } catch (error) {
      console.error(`❌ Error updating image ${key}:`, error);
      return {
        success: false,
        error: error.response?.data?.error?.message || 'Failed to update image'
      };
    }
  }

  // Delete device-specific image
  async deleteDeviceImage(key, device) {
    try {
      const response = await axios.delete(
        `${API_URL}/api/site-images/${key}/device/${device}`,
        {
          headers: this.getAuthHeaders()
        }
      );

      // Clear cache after delete
      this.clearCache();

      return {
        success: true,
        data: response.data.data.image
      };
    } catch (error) {
      console.error(`❌ Error deleting ${device} image for ${key}:`, error);
      return {
        success: false,
        error: error.response?.data?.error?.message || 'Failed to delete device image'
      };
    }
  }

  // Delete main image (all devices)
  async deleteMainImage(key) {
    try {
      const response = await axios.delete(
        `${API_URL}/api/site-images/${key}`,
        {
          headers: this.getAuthHeaders()
        }
      );

      // Clear cache after delete
      this.clearCache();

      return {
        success: true,
        data: response.data.data
      };
    } catch (error) {
      console.error(`❌ Error deleting main image for ${key}:`, error);
      return {
        success: false,
        error: error.response?.data?.error?.message || 'Failed to delete main image'
      };
    }
  }

  // Upload and update site image (combined operation)
  async uploadAndUpdate(key, file, device = null, existingData = {}) {
    try {
      // Step 1: Upload to Cloudinary
      const uploadResult = await this.uploadToCloudinary(file);
      
      if (!uploadResult.success) {
        return uploadResult;
      }

      console.log(`✅ Uploaded ${device || 'image'}:`, uploadResult.imageUrl);

      // Step 2: Prepare update data
      const updateData = {
        name: key.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        category: key.includes('banner') ? 'banner' : 
                 key.includes('logo') ? 'logo' : 'other',
        ...existingData
      };

      if (device) {
        // Device-specific upload
        updateData.responsiveUrls = {
          ...(existingData.responsiveUrls || {}),
          [device]: uploadResult.imageUrl
        };
        // Keep existing main imageUrl or use uploaded as fallback
        if (!existingData.imageUrl) {
          updateData.imageUrl = uploadResult.imageUrl;
        }
      } else {
        // Single upload for all devices
        updateData.imageUrl = uploadResult.imageUrl;
      }

      // Step 3: Update database
      const updateResult = await this.updateSiteImage(key, updateData);
      
      return updateResult;
    } catch (error) {
      console.error('❌ Upload and update failed:', error);
      return {
        success: false,
        error: error.message || 'Failed to upload and update image'
      };
    }
  }
}

export default new ImageService();
