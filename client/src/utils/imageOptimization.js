// Image optimization utility for Cloudinary
// Automatically optimizes images for fast loading

/**
 * Optimize Cloudinary image URL
 * @param {string} imageUrl - Original Cloudinary URL
 * @param {object} options - Optimization options
 * @returns {string} Optimized URL
 */
export const optimizeCloudinaryImage = (imageUrl, options = {}) => {
  if (!imageUrl) return '';
  
  // Check if it's a Cloudinary URL
  if (!imageUrl.includes('res.cloudinary.com')) {
    return imageUrl; // Return as-is if not Cloudinary
  }

  const {
    width = 1200,
    height = 400,
    crop = 'fill',
    quality = 'auto',
    format = 'auto',
    gravity = 'auto'
  } = options;

  // Extract public ID from URL
  // Format: https://res.cloudinary.com/cloud/image/upload/v123/public-id.jpg
  const urlParts = imageUrl.split('/upload/');
  if (urlParts.length !== 2) return imageUrl;

  const [baseUrl] = urlParts;
  let [versionAndId] = urlParts[1].split('?'); // Remove query params

  // Build optimization parameters
  const params = [
    `w_${width}`,           // Width
    `h_${height}`,          // Height
    `c_${crop}`,            // Crop mode
    `q_${quality}`,         // Quality (auto)
    `f_${format}`,          // Format (auto = WebP for modern browsers)
    `g_${gravity}`          // Gravity (auto = smart crop)
  ].join(',');

  // Reconstruct URL with optimization parameters
  return `${baseUrl}/upload/${params}/${versionAndId}`;
};

/**
 * Get responsive image URLs for srcSet
 * @param {string} imageUrl - Original Cloudinary URL
 * @param {array} widths - Array of widths [600, 900, 1200]
 * @returns {string} srcSet string
 */
export const getResponsiveImageSrcSet = (imageUrl, widths = [600, 900, 1200]) => {
  if (!imageUrl) return '';

  return widths
    .map(width => {
      const optimized = optimizeCloudinaryImage(imageUrl, { width });
      return `${optimized} ${width}w`;
    })
    .join(', ');
};

/**
 * Get optimized image URL for specific use case
 * @param {string} imageUrl - Original URL
 * @param {string} type - 'banner' | 'card' | 'thumbnail' | 'hero'
 * @returns {string} Optimized URL
 */
export const getOptimizedImageUrl = (imageUrl, type = 'banner') => {
  const presets = {
    banner: { width: 1200, height: 400, crop: 'fill' },
    card: { width: 400, height: 300, crop: 'fill' },
    thumbnail: { width: 200, height: 200, crop: 'thumb' },
    hero: { width: 1920, height: 600, crop: 'fill' },
    avatar: { width: 100, height: 100, crop: 'thumb' },
    mobile: { width: 600, height: 400, crop: 'fill' }
  };

  const preset = presets[type] || presets.banner;
  return optimizeCloudinaryImage(imageUrl, preset);
};

/**
 * Prefetch image for faster loading
 * @param {string} imageUrl - Image URL to prefetch
 */
export const prefetchImage = (imageUrl) => {
  if (!imageUrl) return;

  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.as = 'image';
  link.href = imageUrl;
  document.head.appendChild(link);
};

/**
 * Preload image (higher priority than prefetch)
 * @param {string} imageUrl - Image URL to preload
 */
export const preloadImage = (imageUrl) => {
  if (!imageUrl) return;

  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = 'image';
  link.href = imageUrl;
  document.head.appendChild(link);
};

/**
 * Create a low-quality placeholder for blur-up effect
 * @param {string} imageUrl - Original image URL
 * @returns {string} Low-quality placeholder URL
 */
export const getPlaceholderImage = (imageUrl) => {
  if (!imageUrl) return '';
  
  // Create a very small, blurred version for placeholder
  return optimizeCloudinaryImage(imageUrl, {
    width: 50,
    height: 50,
    quality: 20,
    crop: 'fill'
  });
};

/**
 * Batch optimize multiple images
 * @param {array} imageUrls - Array of image URLs
 * @param {string} type - Image type for preset
 * @returns {array} Array of optimized URLs
 */
export const batchOptimizeImages = (imageUrls, type = 'banner') => {
  return imageUrls.map(url => getOptimizedImageUrl(url, type));
};

export default {
  optimizeCloudinaryImage,
  getResponsiveImageSrcSet,
  getOptimizedImageUrl,
  prefetchImage,
  preloadImage,
  getPlaceholderImage,
  batchOptimizeImages
};
