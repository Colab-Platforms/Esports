// LCP Optimization Utilities
// Splits data fetching into critical (above-the-fold) and non-critical (below-the-fold)

import React from 'react';

/**
 * Critical data - loads immediately for LCP
 * - Platform stats (small, fast)
 * - Featured tournaments (small, fast)
 */
export const CRITICAL_DATA = [
  'platform-stats',
  'featured-tournaments'
];

/**
 * Non-critical data - loads after 2 seconds (after LCP)
 * - Leaderboards (large, slow)
 * - Testimonials (large, slow)
 * - Servers (medium, medium speed)
 */
export const NON_CRITICAL_DATA = [
  'cs2-leaderboard',
  'bgmi-scoreboards',
  'testimonials',
  'cs2-servers'
];

/**
 * Split data fetching into two phases
 * Phase 1: Critical data (immediate)
 * Phase 2: Non-critical data (after 2 seconds)
 */
export const useLCPOptimization = (fetchFunctions) => {
  const fetchCriticalData = async () => {
    console.log('⚡ Fetching critical data for LCP...');
    
    try {
      // Fetch only critical data
      if (fetchFunctions.fetchPlatformStats) {
        await fetchFunctions.fetchPlatformStats();
      }
      if (fetchFunctions.fetchFeaturedTournaments) {
        await fetchFunctions.fetchFeaturedTournaments();
      }
      
      console.log('✅ Critical data loaded');
      return true;
    } catch (error) {
      console.error('❌ Error fetching critical data:', error);
      return false;
    }
  };

  const fetchNonCriticalData = async () => {
    console.log('📦 Fetching non-critical data...');
    
    try {
      // Fetch non-critical data in parallel
      const promises = [];
      
      if (fetchFunctions.fetchLeaderboards) {
        promises.push(fetchFunctions.fetchLeaderboards());
      }
      if (fetchFunctions.fetchBgmiScoreboards) {
        promises.push(fetchFunctions.fetchBgmiScoreboards());
      }
      if (fetchFunctions.fetchTestimonials) {
        promises.push(fetchFunctions.fetchTestimonials());
      }
      if (fetchFunctions.fetchServers) {
        promises.push(fetchFunctions.fetchServers());
      }
      
      await Promise.all(promises);
      
      console.log('✅ Non-critical data loaded');
      return true;
    } catch (error) {
      console.error('❌ Error fetching non-critical data:', error);
      return false;
    }
  };

  const fetchOptimized = async () => {
    // Phase 1: Load critical data immediately
    await fetchCriticalData();
    
    // Phase 2: Load non-critical data after 2 seconds (after LCP)
    setTimeout(() => {
      fetchNonCriticalData();
    }, 2000);
  };

  return {
    fetchCriticalData,
    fetchNonCriticalData,
    fetchOptimized
  };
};

/**
 * Defer animations until after LCP
 * Prevents animation overhead from blocking render
 */
export const useDeferredAnimations = (delayMs = 3000) => {
  const [showAnimations, setShowAnimations] = React.useState(false);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setShowAnimations(true);
    }, delayMs);

    return () => clearTimeout(timer);
  }, [delayMs]);

  return showAnimations;
};

/**
 * Optimize image URLs for LCP
 * Serve smaller, optimized images for faster loading
 */
export const getOptimizedImageUrl = (url, width = 1200, quality = 80) => {
  if (!url) return null;

  // If it's already a Cloudinary URL, don't double-optimize
  if (url.includes('res.cloudinary.com')) {
    return url;
  }

  // Use Cloudinary fetch API to optimize any image
  const cloudName = 'dlmcpmdpn';
  return `https://res.cloudinary.com/${cloudName}/image/fetch/w_${width},q_${quality},f_auto/${encodeURIComponent(url)}`;
};

/**
 * Preload critical images
 * Helps reduce LCP by preloading hero images
 */
export const preloadImages = (imageUrls) => {
  imageUrls.forEach(url => {
    if (!url) return;

    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = url;
    document.head.appendChild(link);
  });
};

/**
 * Measure LCP in real-time
 * Useful for debugging and monitoring
 */
export const measureLCP = (callback) => {
  if ('PerformanceObserver' in window) {
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          console.log('📊 LCP:', {
            renderTime: entry.renderTime,
            loadTime: entry.loadTime,
            size: entry.size,
            url: entry.url,
            element: entry.element?.tagName
          });

          if (callback) {
            callback(entry);
          }
        }
      });

      observer.observe({ entryTypes: ['largest-contentful-paint'] });

      return observer;
    } catch (error) {
      console.error('Error measuring LCP:', error);
    }
  }
};

/**
 * Measure First Contentful Paint (FCP)
 */
export const measureFCP = (callback) => {
  if ('PerformanceObserver' in window) {
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          console.log('📊 FCP:', {
            startTime: entry.startTime,
            name: entry.name
          });

          if (callback) {
            callback(entry);
          }
        }
      });

      observer.observe({ entryTypes: ['paint'] });

      return observer;
    } catch (error) {
      console.error('Error measuring FCP:', error);
    }
  }
};

/**
 * Get Web Vitals metrics
 */
export const getWebVitals = () => {
  const vitals = {
    lcp: null,
    fcp: null,
    cls: 0,
    fid: null
  };

  // Measure LCP
  if ('PerformanceObserver' in window) {
    try {
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        vitals.lcp = lastEntry.renderTime || lastEntry.loadTime;
      }).observe({ entryTypes: ['largest-contentful-paint'] });

      // Measure FCP
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.name === 'first-contentful-paint') {
            vitals.fcp = entry.startTime;
          }
        }
      }).observe({ entryTypes: ['paint'] });

      // Measure CLS
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) {
            vitals.cls += entry.value;
          }
        }
      }).observe({ entryTypes: ['layout-shift'] });
    } catch (error) {
      console.error('Error measuring Web Vitals:', error);
    }
  }

  return vitals;
};
