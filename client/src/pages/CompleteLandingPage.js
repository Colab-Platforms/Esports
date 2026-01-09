// Complete Premium Landing Page - Gaming Console Style
// Enhanced with animations, real images, and esports theme

import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useSelector } from 'react-redux';
import { selectAuth } from '../store/slices/authSlice';
import { 
  FiAward, FiUsers, FiServer, FiTarget, 
  FiZap, FiShield, FiTrendingUp, FiGift,
  FiArrowRight, FiPlay, FiStar, FiActivity
} from 'react-icons/fi';
import { getGameAsset, getCdnIcon, getMedalIcon } from '../assets/gameAssets';
import GameIcon from '../components/common/GameIcon';
import OptimizedImage from '../components/common/OptimizedImage';
import HeroImageSlider from '../components/common/HeroImageSlider';
import BGMILiveStreamSection from '../components/bgmi/BGMILiveStreamSection';
import { getOptimizedImageUrl } from '../utils/lcpOptimization';

const CompleteLandingPage = () => {
  const { isAuthenticated } = useSelector(selectAuth);
  const navigate = useNavigate();
  const location = useLocation();
  
  // All state declarations first
  const [bgmiScoreboards, setBgmiScoreboards] = useState([]);
  const [cs2Leaderboard, setCs2Leaderboard] = useState([]);
  const [latestBgmiScoreboard, setLatestBgmiScoreboard] = useState(null);
  const [stats, setStats] = useState({
    totalPlayers: '0',
    activeTournaments: '0',
    totalPrizes: '₹0',
    totalMatches: '0'
  });
  const [servers, setServers] = useState([]);
  const [testimonials, setTestimonials] = useState([]);
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(false); // Start as false, only show loading when actually fetching
  const [currentGameIndex, setCurrentGameIndex] = useState(0);
  const [autoPlay, setAutoPlay] = useState(true);
  
  // Cache system for API data - Extended cache duration with localStorage persistence
  const [dataCache, setDataCache] = useState(new Map());
  const [cacheTimestamps, setCacheTimestamps] = useState(new Map());
  const CACHE_DURATION = 10 * 60 * 1000; // Increased to 10 minutes for better persistence
  const CACHE_KEY_PREFIX = 'landing_page_cache_';
  const CACHE_TIMESTAMP_PREFIX = 'landing_page_timestamp_';

  // Cache invalidation trigger - listen for tournament changes
  useEffect(() => {
    const handleTournamentChange = (event) => {
      console.log('🔄 Tournament change detected, clearing cache...', event.detail);
      clearCache();
      // Only refetch if the component is currently visible and mounted
      if (!document.hidden) {
        setTimeout(() => {
          fetchAllData(true); // Force refresh when tournament changes
        }, 100);
      }
    };

    // Listen for custom events that indicate tournament changes
    window.addEventListener('tournamentJoined', handleTournamentChange);
    window.addEventListener('tournamentLeft', handleTournamentChange);
    window.addEventListener('tournamentUpdated', handleTournamentChange);

    return () => {
      window.removeEventListener('tournamentJoined', handleTournamentChange);
      window.removeEventListener('tournamentLeft', handleTournamentChange);
      window.removeEventListener('tournamentUpdated', handleTournamentChange);
    };
  }, []);

  // Auto-refresh data when user comes back to page (visibility change)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('🔄 Page became visible, checking cache age...');
        
        // Check cache age directly using localStorage
        const criticalKeys = ['cs2-leaderboard', 'bgmi-scoreboards', 'platform-stats', 'cs2-servers'];
        const now = Date.now();
        let isStale = false;
        
        for (const key of criticalKeys) {
          const storageTimestamp = localStorage.getItem(CACHE_TIMESTAMP_PREFIX + key);
          const timestamp = storageTimestamp ? parseInt(storageTimestamp) : 0;
          
          if (!timestamp || (now - timestamp) > CACHE_DURATION) {
            isStale = true;
            break;
          }
        }
        
        if (isStale) {
          console.log('🔄 Cache is stale, refreshing data...');
          clearCache();
          fetchAllData(true);
        } else {
          console.log('� Cacche is still fresh, using cached data');
          // Just load from cache without clearing
          loadFromCache();
        }
      }
    };

    const handleFocus = () => {
      console.log('🔄 Window focused, checking cache age...');
      
      // Check cache age directly using localStorage
      const criticalKeys = ['cs2-leaderboard', 'bgmi-scoreboards', 'platform-stats', 'cs2-servers'];
      const now = Date.now();
      let isStale = false;
      
      for (const key of criticalKeys) {
        const storageTimestamp = localStorage.getItem(CACHE_TIMESTAMP_PREFIX + key);
        const timestamp = storageTimestamp ? parseInt(storageTimestamp) : 0;
        
        if (!timestamp || (now - timestamp) > CACHE_DURATION) {
          isStale = true;
          break;
        }
      }
      
      if (isStale) {
        console.log('🔄 Cache is stale, refreshing data...');
        clearCache();
        fetchAllData(true);
      } else {
        console.log('📦 Cache is still fresh, using cached data');
        // Just load from cache without clearing
        loadFromCache();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, []); // Remove cacheTimestamps dependency to prevent infinite loop

  // Refresh data when navigating back to homepage
  useEffect(() => {
    console.log('🔄 Location changed:', location.pathname);
    
    // Only refresh when user navigates to homepage
    if (location.pathname === '/' || location.pathname === '') {
      console.log('🔄 User navigated to homepage, checking cache age...');
      
      // Check cache age directly using localStorage
      const criticalKeys = ['cs2-leaderboard', 'bgmi-scoreboards', 'platform-stats', 'cs2-servers'];
      const now = Date.now();
      let isStale = false;
      
      for (const key of criticalKeys) {
        const storageTimestamp = localStorage.getItem(CACHE_TIMESTAMP_PREFIX + key);
        const timestamp = storageTimestamp ? parseInt(storageTimestamp) : 0;
        
        if (!timestamp || (now - timestamp) > CACHE_DURATION) {
          isStale = true;
          break;
        }
      }
      
      if (isStale) {
        console.log('🔄 Cache is stale, fetching fresh data...');
        clearCache();
        setTimeout(() => {
          fetchAllData(true); // Force refresh on navigation
        }, 100);
      } else {
        console.log('📦 Cache is still fresh, using cached data');
        // Just load from cache without clearing
        setTimeout(() => {
          loadFromCache();
        }, 100);
      }
    }
  }, [location.pathname]); // Remove cacheTimestamps dependency to prevent infinite loop

  // Upcoming games data
  const upcomingGames = [
    { name: 'Valorant', gameType: 'valorant', status: 'Coming Q1 2025', color: 'from-red-500 to-pink-500' },
    { name: 'Apex Legends', gameType: 'apex', status: 'Coming Q2 2025', color: 'from-orange-500 to-red-500' },
    { name: 'Free Fire', gameType: 'freefire', status: 'Coming Q2 2025', color: 'from-yellow-500 to-orange-500' },
    { name: 'Rainbow Six', gameType: 'rainbow6', status: 'Coming Q3 2025', color: 'from-blue-500 to-purple-500' },
    { name: 'FC 24', gameType: 'fc24', status: 'Coming Q3 2025', color: 'from-green-500 to-blue-500' }
  ];

  // Initial data fetch on component mount - with cache checking
  useEffect(() => {
    // Initialize cache from localStorage on mount
    initializeCacheFromStorage();
    
    // Check if we have any cached data at all
    const hasAnyCache = dataCache.size > 0;
    
    if (!hasAnyCache) {
      // First time visit - DON'T show loading, just fetch data
      // setLoading(true); // DISABLED - don't block render
    }
    
    initializeData();
  }, []); // Empty dependency array = runs once on mount

  // Initialize cache from localStorage
  const initializeCacheFromStorage = () => {
    try {
      const keys = Object.keys(localStorage);
      const cacheKeys = keys.filter(key => key.startsWith(CACHE_KEY_PREFIX));
      const now = Date.now();
      
      cacheKeys.forEach(storageKey => {
        const key = storageKey.replace(CACHE_KEY_PREFIX, '');
        const timestampKey = CACHE_TIMESTAMP_PREFIX + key;
        const timestamp = localStorage.getItem(timestampKey);
        
        if (timestamp && (now - parseInt(timestamp)) < CACHE_DURATION) {
          const cachedData = localStorage.getItem(storageKey);
          if (cachedData) {
            const parsedData = JSON.parse(cachedData);
            setDataCache(prev => new Map(prev.set(key, parsedData)));
            setCacheTimestamps(prev => new Map(prev.set(key, parseInt(timestamp))));
          }
        } else {
          // Remove expired cache
          localStorage.removeItem(storageKey);
          localStorage.removeItem(timestampKey);
        }
      });
    } catch (error) {
      console.error('Error initializing cache from storage:', error);
    }
  };

  // Smart initialization that checks cache first
  const initializeData = async () => {
    console.log('🔄 Initializing data...');
    
    // Check if we have valid cached data for all critical sections
    const criticalDataKeys = ['cs2-leaderboard', 'bgmi-scoreboards', 'platform-stats', 'cs2-servers'];
    const cachedDataStatus = criticalDataKeys.map(key => ({
      key,
      hasCache: getCachedData(key) !== null
    }));
    
    console.log('📊 Cache status:', cachedDataStatus);
    
    const hasCachedData = cachedDataStatus.every(item => item.hasCache);
    
    if (hasCachedData) {
      console.log('✅ All critical data cached, loading from cache');
      // Load all data from cache instantly - no loading state needed
      await loadFromCache();
      // Don't set loading to false here, let loadFromCache handle it
    } else {
      console.log('❌ Missing cached data, fetching fresh data');
      // Don't show loading - let page render immediately
      // setLoading(true); // DISABLED - don't block render
      await fetchAllData();
    }
  };

  // Load data from cache for instant display
  const loadFromCache = async () => {
    console.log('📦 Loading data from cache...');
    
    // Load CS2 leaderboard from cache
    const cachedCs2Data = getCachedData('cs2-leaderboard');
    if (cachedCs2Data) {
      console.log('📦 Loaded CS2 leaderboard from cache:', cachedCs2Data.length, 'players');
      setCs2Leaderboard(cachedCs2Data);
    }

    // Load BGMI scoreboards from cache
    const cachedBgmiData = getCachedData('bgmi-scoreboards');
    if (cachedBgmiData) {
      console.log('📦 Loaded BGMI scoreboards from cache:', cachedBgmiData.scoreboards?.length || 0, 'scoreboards');
      setBgmiScoreboards(cachedBgmiData.scoreboards);
      if (cachedBgmiData.latestScoreboard) {
        setLatestBgmiScoreboard(cachedBgmiData.latestScoreboard);
      }
    }

    // Load platform stats from cache
    const cachedStats = getCachedData('platform-stats');
    if (cachedStats) {
      console.log('📦 Loaded platform stats from cache');
      setStats(cachedStats);
    }

    // Load other cached data
    const cachedServers = getCachedData('cs2-servers');
    if (cachedServers) {
      console.log('📦 Loaded CS2 servers from cache:', cachedServers.length, 'servers');
      setServers(cachedServers);
    }

    const cachedTestimonials = getCachedData('testimonials');
    if (cachedTestimonials) {
      console.log('📦 Loaded testimonials from cache:', cachedTestimonials.length, 'testimonials');
      setTestimonials(cachedTestimonials);
    }

    const cachedTournaments = getCachedData('tournaments');
    if (cachedTournaments) {
      console.log('📦 Loaded tournaments from cache:', cachedTournaments.length, 'tournaments');
      setTournaments(cachedTournaments);
    }

    // Set loading to false after cache data is loaded
    setLoading(false);
    console.log('✅ Cache loading completed');
  };

  // Auto-slide upcoming games - separate from data fetching
  useEffect(() => {
    console.log('🎮 Auto-slide useEffect triggered. autoPlay:', autoPlay, 'upcomingGames.length:', upcomingGames.length);
    
    let interval;
    if (autoPlay && upcomingGames.length > 0) {
      console.log('🎮 Starting auto-slide interval');
      interval = setInterval(() => {
        setCurrentGameIndex((prev) => {
          const nextIndex = (prev + 1) % upcomingGames.length;
          console.log('🎮 Auto-slide: changing from', prev, 'to', nextIndex);
          return nextIndex;
        });
      }, 6000);
    } else {
      console.log('🎮 Auto-slide stopped or no games available');
    }
    
    return () => {
      if (interval) {
        console.log('🎮 Clearing auto-slide interval');
        clearInterval(interval);
      }
    };
  }, [autoPlay, upcomingGames.length]);

  // Cache helper functions with localStorage persistence
  const getCachedData = (key) => {
    try {
      // First check in-memory cache
      const memoryTimestamp = cacheTimestamps.get(key);
      const now = Date.now();
      
      if (memoryTimestamp && (now - memoryTimestamp) < CACHE_DURATION) {
        return dataCache.get(key);
      }
      
      // Check localStorage cache
      const storageTimestamp = localStorage.getItem(CACHE_TIMESTAMP_PREFIX + key);
      if (storageTimestamp && (now - parseInt(storageTimestamp)) < CACHE_DURATION) {
        const cachedData = localStorage.getItem(CACHE_KEY_PREFIX + key);
        if (cachedData) {
          const parsedData = JSON.parse(cachedData);
          // Update in-memory cache
          setDataCache(prev => new Map(prev.set(key, parsedData)));
          setCacheTimestamps(prev => new Map(prev.set(key, parseInt(storageTimestamp))));
          return parsedData;
        }
      }
    } catch (error) {
      console.error('Error reading from cache:', error);
    }
    
    return null;
  };

  const setCachedData = (key, data) => {
    try {
      const timestamp = Date.now();
      
      // Update in-memory cache
      setDataCache(prev => new Map(prev.set(key, data)));
      setCacheTimestamps(prev => new Map(prev.set(key, timestamp)));
      
      // Update localStorage cache
      localStorage.setItem(CACHE_KEY_PREFIX + key, JSON.stringify(data));
      localStorage.setItem(CACHE_TIMESTAMP_PREFIX + key, timestamp.toString());
    } catch (error) {
      console.error('Error writing to cache:', error);
    }
  };

  const clearCache = () => {
    // Clear in-memory cache
    setDataCache(new Map());
    setCacheTimestamps(new Map());
    
    // Clear localStorage cache
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith(CACHE_KEY_PREFIX) || key.startsWith(CACHE_TIMESTAMP_PREFIX)) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.error('Error clearing localStorage cache:', error);
    }
  };

  // Helper function to generate testimonials with colors for display
  const generateTestimonialsForDisplay = () => {
    const colorMap = {
      'cs2': 'from-blue-500 to-cyan-500',
      'bgmi': 'from-orange-500 to-red-500',
      'valorant': 'from-purple-500 to-pink-500',
      'freefire': 'from-yellow-500 to-orange-500',
      'ml': 'from-green-500 to-emerald-500',
      'apex': 'from-red-500 to-pink-500',
      'rainbow6': 'from-indigo-500 to-purple-500',
      'fc24': 'from-green-500 to-blue-500'
    };

    const displayTestimonials = testimonials.map(testimonial => ({
      name: testimonial.name,
      game: testimonial.gameTitle,
      gameType: testimonial.gameType,
      text: testimonial.text,
      rating: testimonial.rating,
      color: colorMap[testimonial.gameType] || 'from-gray-500 to-gray-600'
    }));

    // Duplicate for seamless loop (need at least 6 items for smooth 3-column animation)
    const duplicatedTestimonials = [...displayTestimonials, ...displayTestimonials];
    return duplicatedTestimonials.slice(0, 6); // Take first 6 items
  };

  // LCP Optimization: Split data fetching into critical and non-critical
  const fetchCriticalData = async () => {
    console.log('⚡ Fetching critical data for LCP...');
    
    try {
      // Only fetch critical data (small, fast)
      await fetchPlatformStats();
      await new Promise(resolve => setTimeout(resolve, 300));
      
      await fetchTournaments();
      
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
      // Fetch non-critical data in parallel (large, slow)
      await Promise.all([
        fetchLeaderboards(),
        fetchBgmiScoreboards(),
        fetchTestimonials(),
        fetchServers()
      ]);
      
      console.log('✅ Non-critical data loaded');
      return true;
    } catch (error) {
      console.error('❌ Error fetching non-critical data:', error);
      return false;
    }
  };

  const fetchAllData = async (forceRefresh = false) => {
    // Don't set loading to true - let page render immediately
    // setLoading(true); // DISABLED - don't block render
    
    try {
      console.log('🔄 Fetching all data...', forceRefresh ? '(force refresh)' : '(with cache)');
      
      // Phase 1: Load critical data immediately
      await fetchCriticalData();
      
      // Phase 2: Load non-critical data after 2 seconds (after LCP)
      // This prevents large API calls from blocking the initial render
      setTimeout(() => {
        fetchNonCriticalData();
      }, 2000);
      
    } catch (error) {
      console.error('❌ Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLeaderboards = async () => {
    try {
      // Check cache first
      const cachedCs2Data = getCachedData('cs2-leaderboard');
      
      if (cachedCs2Data) {
        setCs2Leaderboard(cachedCs2Data);
        console.log('📦 Using cached CS2 leaderboard data');
        return;
      }

      const API_URL = process.env.REACT_APP_API_URL || '';
      
      // Fetch CS2 leaderboard (limit 3, show only available)
      console.log('🔍 Fetching CS2 leaderboard...');
      const cs2Res = await fetch(`${API_URL}/api/cs2-leaderboard/all-players?limit=3`);
      const cs2Data = await cs2Res.json();
      
      if (cs2Data.success && cs2Data.leaderboard) {
        // Map to simpler format for display
        const mappedData = cs2Data.leaderboard.map(player => ({
          username: player.displayName || player.username,
          kills: player.stats.total_kills,
          totalKills: player.stats.total_kills,
          rank: player.rank,
          avatar: player.avatar,
          kdr: player.stats.kdr
        }));
        
        console.log('✅ CS2 leaderboard data:', mappedData.length, 'players');
        setCs2Leaderboard(mappedData);
        setCachedData('cs2-leaderboard', mappedData);
      } else {
        console.log('⚠️ No CS2 leaderboard data found');
      }
      
    } catch (error) {
      console.error('❌ Error fetching leaderboards:', error);
    }
  };

  const fetchBgmiScoreboards = async () => {
    try {
      // Check cache first
      const cachedData = getCachedData('bgmi-scoreboards');
      if (cachedData) {
        console.log('📦 Using cached BGMI scoreboards:', cachedData.scoreboards.length);
        setBgmiScoreboards(cachedData.scoreboards);
        if (cachedData.latestScoreboard) {
          setLatestBgmiScoreboard(cachedData.latestScoreboard);
        }
        return;
      }

      const API_URL = process.env.REACT_APP_API_URL || '';
      const url = `${API_URL}/api/tournaments/bgmi/scoreboards?limit=6`;
      console.log('🔍 Fetching BGMI scoreboards from:', url);
      
      // Direct fetch without API service to avoid rate limiting
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        }
      });
      
      console.log('📥 BGMI scoreboards response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('📊 BGMI scoreboards API response:', data);
      
      if (data.success && data.data.scoreboards) {
        console.log('✅ Found BGMI scoreboards:', data.data.scoreboards.length);
        setBgmiScoreboards(data.data.scoreboards);
        
        // Set the latest one for backward compatibility
        let latestScoreboard = null;
        if (data.data.scoreboards.length > 0) {
          latestScoreboard = {
            ...data.data.scoreboards[0],
            tournamentName: data.data.scoreboards[0].tournament.name
          };
          setLatestBgmiScoreboard(latestScoreboard);
        }

        // Cache the data
        setCachedData('bgmi-scoreboards', {
          scoreboards: data.data.scoreboards,
          latestScoreboard
        });
      } else {
        console.log('⚠️ No BGMI scoreboards found in response');
        setBgmiScoreboards([]);
        setCachedData('bgmi-scoreboards', { scoreboards: [], latestScoreboard: null });
      }
    } catch (error) {
      console.error('❌ Error fetching BGMI scoreboards:', error);
      setBgmiScoreboards([]);
      setCachedData('bgmi-scoreboards', { scoreboards: [], latestScoreboard: null });
    }
  };

  const fetchPlatformStats = async () => {
    try {
      // Check cache first
      const cachedData = getCachedData('platform-stats');
      if (cachedData) {
        console.log('📦 Using cached platform stats');
        setStats(cachedData);
        return;
      }

      const API_URL = process.env.REACT_APP_API_URL || '';
      
      const [statsRes, usersRes] = await Promise.all([
        fetch(`${API_URL}/api/tournaments/stats`),
        fetch(`${API_URL}/api/users/count`)
      ]);
      
      const statsData = await statsRes.json();
      const usersData = await usersRes.json();
      
      if (statsData.success && statsData.data) {
        const newStats = {
          totalPlayers: usersData.success ? usersData.count.toString() : '0',
          activeTournaments: statsData.data.activeTournaments || '0',
          totalPrizes: statsData.data.totalPrizes || '₹0',
          totalMatches: statsData.data.totalTransactions || '0'
        };
        
        console.log('✅ Platform stats fetched:', newStats);
        setStats(newStats);
        setCachedData('platform-stats', newStats);
      }
    } catch (error) {
      console.error('❌ Error fetching stats:', error);
    }
  };

  const fetchServers = async (forceRefresh = false) => {
    try {
      // Check cache first (unless force refresh)
      if (!forceRefresh) {
        const cachedData = getCachedData('cs2-servers');
        if (cachedData) {
          console.log('📦 Using cached CS2 servers data');
          setServers(cachedData);
          return;
        }
      } else {
        console.log('🔄 Force refreshing CS2 servers (bypassing cache)');
      }

      const API_URL = process.env.REACT_APP_API_URL || '';
      console.log('🔍 Fetching CS2 tournaments from:', `${API_URL}/api/tournaments?gameType=cs2&status=active`);
      
      // Add cache-busting parameter to ensure fresh data
      const timestamp = Date.now();
      const response = await fetch(`${API_URL}/api/tournaments?gameType=cs2&status=active&t=${timestamp}`);
      const data = await response.json();
      
      console.log('📊 CS2 tournaments API response:', data);
      
      if (data.success && data.data && data.data.tournaments) {
        console.log('✅ Found tournaments:', data.data.tournaments.length);
        
        // Map CS2 tournaments to server display format
        const mappedServers = data.data.tournaments.map((tournament, index) => {
          console.log('🎮 Processing tournament:', tournament.name);
          
          const serverData = {
            id: tournament._id,
            name: tournament.roomDetails?.cs2?.serverName || tournament.name || `CS2 Server #${index + 1}`,
            players: `${tournament.currentParticipants}/${tournament.maxParticipants}`,
            status: tournament.status === 'active' ? 'active' : 'inactive',
            map: tournament.roomDetails?.cs2?.mapPool?.[0] || 'de_dust2',
            ping: '12ms', // Default ping for now
            region: tournament.region || 'mumbai',
            ip: tournament.roomDetails?.cs2?.serverIp || '',
            port: tournament.roomDetails?.cs2?.serverPort || '27015',
            prizePool: tournament.prizePool || 0,
            tournamentName: tournament.name
          };
          
          console.log('🗺️ Mapped server:', serverData);
          return serverData;
        });
        
        console.log('🎯 Setting servers:', mappedServers);
        setServers(mappedServers);
        setCachedData('cs2-servers', mappedServers);
      } else {
        console.log('⚠️ No tournaments found or invalid response structure');
        // Fallback to empty array if no CS2 tournaments
        setServers([]);
        setCachedData('cs2-servers', []);
      }
    } catch (error) {
      console.error('❌ Error fetching CS2 tournaments:', error);
      // Fallback to empty array
      setServers([]);
      setCachedData('cs2-servers', []);
    }
  };

  const fetchTestimonials = async () => {
    try {
      // Check cache first
      const cachedData = getCachedData('testimonials');
      if (cachedData) {
        console.log('📦 Using cached testimonials');
        setTestimonials(cachedData);
        return;
      }

      const API_URL = process.env.REACT_APP_API_URL || '';
      const response = await fetch(`${API_URL}/api/users/testimonials`);
      const data = await response.json();
      
      if (data.success && data.data) {
        console.log('✅ Testimonials fetched:', data.data.length);
        setTestimonials(data.data);
        setCachedData('testimonials', data.data);
      } else {
        // Fallback to hardcoded testimonials if API fails
        const fallbackTestimonials = [
          { name: 'Rahul K.', gameTitle: 'CS2 Player', gameType: 'cs2', text: 'Best platform for competitive CS2 in India. Auto stats tracking is amazing!', rating: 5 },
          { name: 'Priya S.', gameTitle: 'BGMI Player', gameType: 'bgmi', text: 'Love the free tournaments and smooth registration process. Highly recommended!', rating: 5 },
          { name: 'Arjun M.', gameTitle: 'Pro Gamer', gameType: 'valorant', text: 'Finally a platform that takes esports seriously. Great prizes and fair play.', rating: 5 }
        ];
        console.log('📦 Using fallback testimonials');
        setTestimonials(fallbackTestimonials);
        setCachedData('testimonials', fallbackTestimonials);
      }
    } catch (error) {
      console.error('❌ Error fetching testimonials:', error);
      // Fallback to hardcoded testimonials
      const fallbackTestimonials = [
        { name: 'Rahul K.', gameTitle: 'CS2 Player', gameType: 'cs2', text: 'Best platform for competitive CS2 in India. Auto stats tracking is amazing!', rating: 5 },
        { name: 'Priya S.', gameTitle: 'BGMI Player', gameType: 'bgmi', text: 'Love the free tournaments and smooth registration process. Highly recommended!', rating: 5 },
        { name: 'Arjun M.', gameTitle: 'Pro Gamer', gameType: 'valorant', text: 'Finally a platform that takes esports seriously. Great prizes and fair play.', rating: 5 }
      ];
      setTestimonials(fallbackTestimonials);
      setCachedData('testimonials', fallbackTestimonials);
    }
  };

  const fetchTournaments = async () => {
    try {
      // Check cache first
      const cachedData = getCachedData('tournaments');
      if (cachedData) {
        console.log('📦 Using cached tournaments');
        setTournaments(cachedData);
        return;
      }

      const API_URL = process.env.REACT_APP_API_URL || '';
      const response = await fetch(`${API_URL}/api/tournaments?status=registration_open&limit=3`);
      const data = await response.json();
      
      if (data.success) {
        const tournamentsData = data.data || [];
        console.log('✅ Tournaments fetched:', tournamentsData.length);
        setTournaments(tournamentsData);
        setCachedData('tournaments', tournamentsData);
      }
    } catch (error) {
      console.error('❌ Error fetching tournaments:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gaming-dark">
      {/* Hero Section with Slider */}
      <HeroImageSlider />

      {/* Platform Stats - Simple Text Format */}
      <section className="py-12 bg-gaming-dark/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center"
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              <div>
                <div className="text-3xl font-gaming font-bold text-gaming-gold mb-1">
                  {stats.totalPlayers}
                </div>
                <div className="text-gray-400 text-sm">Total Players</div>
              </div>
              <div>
                <div className="text-3xl font-gaming font-bold text-gaming-gold mb-1">
                  {stats.totalMatches}
                </div>
                <div className="text-gray-400 text-sm">Matches Played</div>
              </div>
              <div>
                <div className="text-3xl font-gaming font-bold text-gaming-gold mb-1">
                  {stats.totalPrizes}
                </div>
                <div className="text-gray-400 text-sm">Prizes Distributed</div>
              </div>
              <div>
                <div className="text-3xl font-gaming font-bold text-gaming-gold mb-1">
                  {stats.activeTournaments}
                </div>
                <div className="text-gray-400 text-sm">Active Tournaments</div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* LIVE STREAM SECTION - DISABLED FOR NOW */}
      {/* 
      <section className="py-12 bg-gaming-dark/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h2 className="text-3xl md:text-4xl font-gaming font-bold text-white mb-2">
              🔴 LIVE NOW
            </h2>
            <p className="text-gray-400 font-gaming">Watch live tournament streams</p>
          </div>
          <BGMILiveStreamSection />
        </div>
      </section>
      */}

      {/* Live Leaderboard Section - Gaming Console Style */}
      <section className="py-20 bg-gaming-charcoal/30 relative overflow-hidden">
        {/* Animated Background Grid */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0" style={{
            backgroundImage: 'linear-gradient(#FFD700 1px, transparent 1px), linear-gradient(90deg, #FFD700 1px, transparent 1px)',
            backgroundSize: '50px 50px'
          }}></div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <motion.div
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="inline-block px-6 py-2 bg-gaming-gold/10 border-2 border-gaming-gold/30 rounded-full mb-4"
            >
              <span className="text-gaming-gold font-bold text-sm flex items-center">
                <FiActivity className="mr-2 animate-pulse" />
                LIVE RANKINGS
              </span>
            </motion.div>
            <h2 className="text-4xl md:text-5xl font-gaming font-bold text-white mb-4">
              Live Leaderboards
            </h2>
            <p className="text-gray-400 text-lg font-gaming">Real-time rankings • Updated every match</p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* BGMI Leaderboard - Gaming Console Style */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative"
            >
              {/* Console Border Effect */}
              <div className="absolute inset-0 bg-gradient-to-br from-orange-500/20 to-red-500/20 rounded-2xl filter blur-xl"></div>
              
              <div className="relative bg-gaming-charcoal border-2 border-orange-500/30 rounded-2xl p-6 shadow-2xl">
                {/* Console Header */}
                <div className="flex items-center justify-between mb-6 pb-4 border-b-2 border-orange-500/20">
                  <div className="flex items-center space-x-3">
                    <motion.div
                      animate={{ rotate: [0, 360] }}
                      transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                      className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl shadow-lg"
                    >
                      <GameIcon gameType="bgmi" size="lg" />
                    </motion.div>
                    <div>
                      <h3 className="text-2xl font-gaming font-bold text-white">BGMI</h3>
                      <p className="text-xs text-gray-400">Mobile Legends</p>
                    </div>
                  </div>
                  <Link to="/leaderboard" className="text-gaming-gold hover:text-gaming-accent text-sm font-bold flex items-center group">
                    View All 
                    <motion.div
                      animate={{ x: [0, 5, 0] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    >
                      <FiArrowRight className="ml-1" />
                    </motion.div>
                  </Link>
                </div>

                {/* Tournament Results Gallery - Show Tournament Images */}
                <div className="space-y-3">
                  {loading ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gaming-gold mx-auto mb-2"></div>
                      <p className="text-gray-400 text-sm">Loading tournaments...</p>
                    </div>
                  ) : bgmiScoreboards.length > 0 ? (
                    bgmiScoreboards.map((scoreboard, idx) => (
                      <motion.div
                        key={scoreboard._id}
                        initial={{ opacity: 0, x: -20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: idx * 0.1 }}
                        whileHover={{ scale: 1.02, x: 5 }}
                        className="relative group cursor-pointer"
                        onClick={() => window.open(scoreboard.imageUrl, '_blank')}
                      >
                        <div className="relative bg-gaming-dark/70 rounded-lg overflow-hidden border border-gray-700 group-hover:border-gaming-gold/50 transition-all backdrop-blur-sm">
                          <div className="flex">
                            {/* Image Section */}
                            <div className="w-24 h-16 flex-shrink-0">
                              <img
                                src={getOptimizedImageUrl(scoreboard.imageUrl, 200, 80)}
                                loading="lazy"
                                alt={scoreboard.description}
                                className="w-full h-full object-cover group-hover:opacity-80 transition-opacity"
                              />
                            </div>
                            
                            {/* Details Section */}
                            <div className="flex-1 p-3 flex items-center justify-between">
                              <div>
                                <div className="font-bold text-white text-sm group-hover:text-gaming-gold transition-colors">
                                  {scoreboard.tournament.name}
                                </div>
                                <div className="text-xs text-gray-400 flex items-center">
                                  <span className="w-2 h-2 bg-green-400 rounded-full mr-2"></span>
                                  {new Date(scoreboard.tournament.endDate).toLocaleDateString()}
                                </div>
                              </div>
                              
                              <div className="text-right">
                                <div className="text-xs font-bold text-gaming-gold">
                                  #{idx + 1}
                                </div>
                                <div className="text-xs text-gray-400">Latest</div>
                              </div>
                            </div>
                          </div>
                          
                          {/* Hover Overlay */}
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-orange-500 text-black px-3 py-1 rounded-full text-xs font-bold">
                              View Full Results
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <div className="text-gray-400 text-4xl mb-2">🏆</div>
                      <p className="text-gray-400 text-sm">No tournament results yet</p>
                      <p className="text-xs text-gray-500 mt-1">Results will appear here after tournaments</p>
                    </div>
                  )}
                </div>



                {/* Console Footer */}
                <div className="mt-6 pt-4 border-t-2 border-orange-500/20">
                  <Link
                    to="/leaderboard"
                    className="block w-full text-center py-3 bg-gradient-to-r from-orange-500/10 to-red-500/10 hover:from-orange-500/20 hover:to-red-500/20 border-2 border-orange-500/30 rounded-lg text-orange-400 font-bold transition-all"
                  >
                    View Full Leaderboard
                  </Link>
                </div>
              </div>
            </motion.div>

            {/* CS2 Leaderboard - Gaming Console Style */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative"
            >
              {/* Console Border Effect */}
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-2xl filter blur-xl"></div>
              
              <div className="relative bg-gaming-charcoal border-2 border-blue-500/30 rounded-2xl p-6 shadow-2xl">
                {/* Console Header */}
                <div className="flex items-center justify-between mb-6 pb-4 border-b-2 border-blue-500/20">
                  <div className="flex items-center space-x-3">
                    <motion.div
                      animate={{ rotate: [0, -360] }}
                      transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                      className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl shadow-lg"
                    >
                      <GameIcon gameType="cs2" size="lg" />
                    </motion.div>
                    <div>
                      <h3 className="text-2xl font-gaming font-bold text-white">CS2</h3>
                      <p className="text-xs text-gray-400">Counter-Strike 2</p>
                    </div>
                  </div>
                  <Link to="/leaderboard" className="text-gaming-gold hover:text-gaming-accent text-sm font-bold flex items-center group">
                    View All 
                    <motion.div
                      animate={{ x: [0, 5, 0] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    >
                      <FiArrowRight className="ml-1" />
                    </motion.div>
                  </Link>
                </div>

                {/* Leaderboard Entries */}
                <div className="space-y-3">
                  {loading ? (
                    [1,2,3].map(i => (
                      <div key={i} className="bg-gaming-dark/50 rounded-lg p-4 animate-pulse">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-gray-700 rounded-lg"></div>
                          <div className="flex-1">
                            <div className="h-4 bg-gray-700 rounded w-24 mb-2"></div>
                            <div className="h-3 bg-gray-700 rounded w-16"></div>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : cs2Leaderboard.length > 0 ? (
                    cs2Leaderboard.map((player, idx) => (
                      <motion.div
                        key={player.username || idx}
                        initial={{ opacity: 0, x: 20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: idx * 0.1 }}
                        whileHover={{ scale: 1.02, x: -5 }}
                        className="relative group"
                      >
                        {/* Rank Glow */}
                        {idx < 3 && (
                          <div className={`absolute inset-0 rounded-lg filter blur-md ${
                            idx === 0 ? 'bg-yellow-500/20' :
                            idx === 1 ? 'bg-gray-400/20' :
                            'bg-orange-500/20'
                          }`}></div>
                        )}
                        
                        <div className="relative bg-gaming-dark/70 rounded-lg p-4 border border-gray-700 group-hover:border-gaming-gold/50 transition-all backdrop-blur-sm">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                              {/* Rank Badge */}
                              <motion.div
                                whileHover={{ rotate: [0, -10, 10, -10, 0] }}
                                className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg shadow-lg ${
                                  idx === 0 ? 'text-black' :
                                  idx === 1 ? 'text-black' :
                                  idx === 2 ? 'text-black' :
                                  'bg-gray-700 text-white'
                                }`}
                              >
                                {getMedalIcon(idx) ? <img src={getMedalIcon(idx)} alt={`Medal ${idx + 1}`} /> : idx + 1}
                              </motion.div>
                              
                              <div>
                                <div className="font-bold text-white group-hover:text-gaming-gold transition-colors">
                                  {player.username}
                                </div>
                                <div className="text-xs text-gray-400 flex items-center">
                                  <span className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse"></span>
                                  Rank #{idx + 1}
                                </div>
                              </div>
                            </div>

                            <div className="text-right">
                              <motion.div
                                animate={{ scale: [1, 1.1, 1] }}
                                transition={{ duration: 2, repeat: Infinity, delay: idx * 0.2 }}
                                className="text-xl font-bold text-gaming-gold"
                              >
                                {player.kills || player.totalKills || 0}
                              </motion.div>
                              <div className="text-xs text-gray-400">Kills</div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))
                  ) : (
                    <div className="text-center py-12 text-gray-400">
                      <div className="text-4xl mb-4">
                        <GameIcon gameType="cs2" size="xl" />
                      </div>
                      <p>No leaderboard data yet</p>
                      <p className="text-sm mt-2">Be the first to compete!</p>
                    </div>
                  )}
                </div>

                {/* Console Footer */}
                <div className="mt-6 pt-4 border-t-2 border-blue-500/20">
                  <Link
                    to="/leaderboard"
                    className="block w-full text-center py-3 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 hover:from-blue-500/20 hover:to-cyan-500/20 border-2 border-blue-500/30 rounded-lg text-blue-400 font-bold transition-all"
                  >
                    View Full Leaderboard
                  </Link>
                </div>
              </div>
            </motion.div>

          </div>
        </div>
      </section>

      {/* BGMI Tournament Section - Separate Section Below Leaderboards */}
      <section className="py-20 bg-gaming-charcoal/30 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            {/* BGMI Official Image */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative group"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-orange-500/30 to-red-500/30 rounded-2xl filter blur-3xl group-hover:blur-2xl transition-all"></div>
              
              <div className="relative rounded-2xl overflow-hidden border-4 border-orange-500/30 shadow-2xl">
                <OptimizedImage
                  src={getGameAsset('bgmi', 'hero')}
                  alt="BGMI Tournaments"
                  className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
                
                {/* Floating Badge */}
                <motion.div
                  animate={{ y: [0, -10, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute top-6 right-6 bg-gaming-gold text-black px-4 py-2 rounded-full font-bold text-sm shadow-lg flex items-center space-x-2"
                >
                  <GameIcon gameType="freefire" size="sm" />
                  <span>LIVE NOW</span>
                </motion.div>
              </div>
            </motion.div>

            {/* Tournament Info */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <div className="flex items-center space-x-3 mb-6">
                <motion.div
                  className="text-6xl"
                >
                  <GameIcon gameType="bgmi" size="2xl" />
                </motion.div>
                <div>
                  <h2 className="text-4xl md:text-5xl font-gaming font-bold text-white">
                    BGMI Tournaments
                  </h2>
                  <p className="text-orange-400 font-bold">Battlegrounds Mobile India</p>
                </div>
              </div>
              
              <p className="text-xl text-gray-300 mb-8">
                Compete in India's biggest mobile esports tournaments with real prizes and glory
              </p>

              <div className="space-y-4 mb-8">
                {[
                  { icon: <FiZap />, title: 'Free Entry', desc: 'All tournaments completely free to join' },
                  { icon: <FiAward />, title: 'Real Prizes', desc: 'Win cash prizes and exclusive rewards' },
                  { icon: <FiUsers />, title: 'Team & Solo', desc: 'Compete solo or with your squad' }
                ].map((item, idx) => (
                  <motion.div
                    key={item.title}
                    initial={{ opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: idx * 0.1 }}
                    whileHover={{ x: 10 }}
                    className="flex items-start space-x-4 p-4 bg-gaming-charcoal/50 rounded-lg border border-gray-700 hover:border-gaming-gold/50 transition-all"
                  >
                    <div className="text-gaming-gold mt-1 text-xl">{item.icon}</div>
                    <div>
                      <h4 className="font-bold text-white mb-1">{item.title}</h4>
                      <p className="text-gray-400 text-sm">{item.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  to="/bgmi"
                  className="btn-gaming text-lg px-8 py-4 text-center"
                >
                  View BGMI Tournaments
                </Link>
                <Link
                  to="/tournaments"
                  className="px-8 py-4 border-2 border-gaming-gold text-gaming-gold rounded-lg hover:bg-gaming-gold hover:text-black transition-all duration-300 font-bold text-center"
                >
                  All Tournaments
                </Link>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Grid - Gaming Console Style */}
      <section className="py-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-gaming-dark via-gaming-charcoal/50 to-gaming-dark"></div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-4xl md:text-5xl font-gaming font-bold text-white mb-4">
              Platform Features
            </h2>
            <p className="text-gray-400 text-lg font-gaming">Everything you need for competitive gaming</p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: <img src={getCdnIcon('features', 'tournaments')} className="w-10 h-10" alt="Tournaments" />, title: 'Tournaments', desc: 'Compete in CS2 & BGMI', color: 'from-yellow-500 to-orange-500', stat: stats.activeTournaments + ' Active' },
              { icon: <img src={getCdnIcon('features', 'leaderboards')} className="w-10 h-10" alt="Leaderboards" />, title: 'Live Leaderboards', desc: 'Real-time rankings', color: 'from-yellow-500 to-orange-500', stat: 'Updated Live' },
              { icon: <img src={getCdnIcon('features', 'servers')} className="w-10 h-10" alt="Servers" />, title: 'Dedicated Servers', desc: 'Auto stats tracking', color: 'from-yellow-500 to-orange-500', stat: '2 Servers' },
              { icon: <FiUsers className="w-10 h-10" />, title: 'Team System', desc: 'Create & compete', color: 'from-yellow-500 to-orange-500', stat: stats.totalPlayers + ' Players' }
            ].map((feature, idx) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                whileHover={{ y: -10, scale: 1.05 }}
                className="relative group"
              >
                {/* Glow Effect */}
                <div className={`absolute inset-0 bg-gradient-to-br ${feature.color} opacity-0 group-hover:opacity-20 rounded-xl filter blur-xl transition-opacity`}></div>
                
                <div className="relative bg-gaming-charcoal border-2 border-gray-700 group-hover:border-gaming-gold/50 rounded-xl p-6 transition-all duration-300 overflow-hidden">
                  {/* Corner Accent */}
                  <div className="absolute top-0 right-0 w-20 h-20 bg-gaming-gold/5 rounded-bl-full"></div>
                  
                  <div className={`inline-flex p-4 rounded-lg bg-gradient-to-br ${feature.color} bg-opacity-10 text-white mb-4 shadow-lg`}>
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">{feature.title}</h3>
                  <p className="text-gray-400 mb-4 text-sm">{feature.desc}</p>
                  <div className="text-gaming-gold font-bold text-sm flex items-center">
                    <span className="w-2 h-2 bg-gaming-gold rounded-full mr-2 animate-pulse"></span>
                    {feature.stat}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Social Gaming / Community */}
      <section className="py-20 bg-gaming-charcoal/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-4xl md:text-5xl font-gaming font-bold text-white mb-4">
              Social Gaming
            </h2>
            <p className="text-gray-400 text-lg font-gaming">Connect, compete, and conquer together</p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: <img src={getCdnIcon('social', 'friends')} height={70} width={70} alt="Friends System" />, title: 'Friends System', desc: 'Add friends, track progress, compete together', features: ['Send requests', 'View profiles', 'Compare stats'], color: 'from-green-500 to-emerald-500' },
              { icon: <img src={getCdnIcon('social', 'teams')} height={70} width={70} alt="Team Management" />, title: 'Team Management', desc: 'Create teams, invite members, dominate', features: ['Custom teams', 'Invite system', 'Team tournaments'], color: 'from-blue-500 to-cyan-500' },
              { icon: <img src={getCdnIcon('social', 'challenges')} height={70} width={70} alt="Challenges" />, title: 'Challenges', desc: 'Challenge friends and prove your skills', features: ['1v1 challenges', 'Custom rules', 'Coming soon'], color: 'bg-gradient-to-b from-purple-500 to-pink-500' }
            ].map((item, idx) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                whileHover={{ y: -5, scale: 1.02 }}
                className="relative group"
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${item.color} opacity-0 group-hover:opacity-10 rounded-xl filter blur-xl transition-opacity`}></div>
                
                <div className="relative bg-gaming-charcoal border-2 border-gray-700 group-hover:border-gaming-gold/50 rounded-xl p-6 transition-all h-80 flex flex-col">
                  <motion.div
                    whileHover={{ rotate: [0, -10, 10, -10, 0], scale: 1.2 }}
                    className="text-5xl mb-4"
                  >
                    {item.icon}
                  </motion.div>
                  <h3 className="text-2xl font-gaming font-bold text-white mb-3">{item.title}</h3>
                  <p className="text-gray-400 mb-4 flex-1">{item.desc}</p>
                  <div className="space-y-2 mt-auto">
                    {item.features.map((feature, i) => (
                      <div key={i} className="flex items-center text-sm text-gray-300 font-gaming">
                        <div className={`w-2 h-2 bg-gradient-to-r ${item.color} rounded-full mr-2`}></div>
                        {feature}
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CS2 Servers - Only 2 Mumbai Servers */}
      <section className="py-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-gaming-dark via-blue-900/10 to-gaming-dark"></div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <div className="flex items-center justify-center space-x-3 mb-4">
              <motion.div
                className="text-5xl"
              >
                <GameIcon gameType="cs2" size="2xl" />
              </motion.div>
              <h2 className="text-4xl md:text-5xl font-gaming font-bold text-white">
                CS2 Tournament Servers
              </h2>
            </div>
            <p className="text-gray-400 text-lg font-gaming">Active Tournaments • Real Prizes • Join Now</p>
            
            {/* Temporary Debug Button - Remove after testing */}
            <div className="mt-4">
              <button
                onClick={async () => {
                  console.log('🔄 Clearing CS2 server cache and refreshing...');
                  clearCache(); // Clear all cache
                  setServers([]); // Clear current servers
                  await fetchServers(); // Fetch fresh data
                  console.log('✅ CS2 servers refreshed');
                }}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
              >
                🔄 Refresh CS2 Servers
              </button>
            </div>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {servers.length > 0 ? (
              servers.map((server, idx) => (
                <motion.div
                  key={server.id}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.2 }}
                  whileHover={{ y: -10, scale: 1.05 }}
                  className="relative group"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-xl filter blur-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  
                  <div className="relative bg-gaming-charcoal border-2 border-blue-500/30 rounded-xl p-6 shadow-2xl">
                    {/* Server Status Indicator */}
                    <div className="absolute top-4 right-4">
                      <motion.div
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className={`w-3 h-3 rounded-full ${
                          server.status === 'active' ? 'bg-green-400' : 'bg-red-400'
                        } shadow-lg`}
                      ></motion.div>
                    </div>

                    <h3 className="text-xl font-bold text-white mb-4">{server.name}</h3>
                    
                    <div className="space-y-3 mb-6">
                      <div className="flex items-center justify-between p-3 bg-gaming-dark/50 rounded-lg">
                        <span className="text-gray-400 text-sm">Status:</span>
                        <span className={`font-bold text-sm ${
                          server.status === 'active' ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {server.status === 'active' ? '🟢 Active' : '🔴 Offline'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-gaming-dark/50 rounded-lg">
                        <span className="text-gray-400 text-sm">Players:</span>
                        <span className="text-white font-bold">{server.players}</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-gaming-dark/50 rounded-lg">
                        <span className="text-gray-400 text-sm">Map:</span>
                        <span className="text-gaming-gold font-bold">{server.map}</span>
                      </div>
                      {server.prizePool > 0 && (
                        <div className="flex items-center justify-between p-3 bg-gaming-dark/50 rounded-lg">
                          <span className="text-gray-400 text-sm">Prize Pool:</span>
                          <span className="text-gaming-gold font-bold">₹{server.prizePool}</span>
                        </div>
                      )}
                    </div>

                    <Link
                      to={`/tournaments/${server.id}`}
                      className="block w-full text-center py-3 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 hover:from-blue-500/20 hover:to-cyan-500/20 border-2 border-blue-500/30 rounded-lg text-blue-400 font-bold transition-all"
                    >
                      Join Tournament
                    </Link>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="col-span-2 text-center py-12">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  className="text-6xl mb-6"
                >
                  <GameIcon gameType="cs2" size="2xl" />
                </motion.div>
                <h3 className="text-2xl font-bold text-white mb-4">No Active CS2 Tournaments</h3>
                <p className="text-gray-400 mb-6">Check back soon for new tournaments!</p>
                <Link
                  to="/tournaments"
                  className="inline-block px-6 py-3 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border-2 border-blue-500/30 rounded-lg text-blue-400 font-bold hover:from-blue-500/30 hover:to-cyan-500/30 transition-all"
                >
                  View All Tournaments
                </Link>
              </div>
            )}
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mt-12"
          >
            <Link
              to="/cs2"
              className="inline-flex items-center text-gaming-gold hover:text-gaming-accent font-bold text-lg group"
            >
              View All CS2 Features
              <motion.div
                animate={{ x: [0, 5, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                <FiArrowRight className="ml-2" />
              </motion.div>
            </Link>
          </motion.div>
        </div>
      </section>



      {/* More Games Coming Soon - Classic Premium Design */}
      <section className="py-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-gaming-dark via-purple-900/10 to-gaming-dark"></div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-gaming font-bold text-white mb-4">
              More Games Coming Soon
            </h2>
            <p className="text-gray-400 text-lg font-gaming">Expanding to more titles in 2025</p>
          </motion.div>

          {/* Classic Premium Carousel */}
          <div className="relative max-w-4xl mx-auto">


            {/* Premium Card Container */}
            <div className="overflow-hidden rounded-2xl shadow-2xl">
              <motion.div
                className="flex"
                animate={{ x: `${-currentGameIndex * 100}%` }}
                transition={{ 
                  type: "spring", 
                  stiffness: 150, 
                  damping: 20,
                  duration: 0.6
                }}
              >
                {upcomingGames.map((game, idx) => (
                  <div key={game.name} className="w-full flex-shrink-0 px-4">
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: idx * 0.1 }}
                      whileHover={{ 
                        y: -8,
                        scale: 1.02,
                        transition: { duration: 0.3 }
                      }}
                      className="relative group h-80"
                    >
                      {/* Subtle Premium Glow */}
                      <div className={`absolute inset-0 bg-gradient-to-br ${game.color} opacity-10 group-hover:opacity-20 rounded-2xl filter blur-xl transition-all duration-500`}></div>
                      
                      {/* Classic Premium Card */}
                      <div className="relative h-full bg-gradient-to-br from-gaming-charcoal to-gaming-dark border-2 border-gray-700 group-hover:border-gaming-gold/50 rounded-2xl overflow-hidden shadow-2xl transition-all duration-300">
                        {/* Premium Border Effect */}
                        <div className="absolute inset-0 bg-gradient-to-br from-gaming-gold/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                        
                        {/* Classic Premium Content */}
                        <div className="relative h-full flex flex-col items-center justify-center p-8 text-center">
                          {/* Simple Elegant Icon */}
                          <motion.div
                            animate={{ 
                              scale: [1, 1.05, 1]
                            }}
                            transition={{ 
                              duration: 3, 
                              repeat: Infinity,
                              ease: "easeInOut"
                            }}
                            whileHover={{
                              scale: 1.1,
                              transition: { duration: 0.3 }
                            }}
                            className="text-7xl mb-6 filter drop-shadow-lg"
                          >
                            <GameIcon gameType={game.gameType} size="2xl" />
                          </motion.div>
                          
                          {/* Classic Game Title */}
                          <h3 className="text-3xl font-gaming font-bold text-white mb-4 group-hover:text-gaming-gold transition-colors duration-300">
                            {game.name}
                          </h3>
                          
                          {/* Premium Status Badge */}
                          <motion.div
                            whileHover={{ scale: 1.05 }}
                            className={`inline-flex items-center px-6 py-3 bg-gradient-to-r ${game.color} rounded-full text-white font-gaming font-bold text-sm shadow-lg backdrop-blur-sm mb-4`}
                          >
                            <span className="mr-2">🚀</span>
                            {game.status}
                          </motion.div>
                          
                          {/* Simple Description */}
                          <p className="text-gray-300 font-gaming text-sm">
                            Get ready for epic tournaments
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  </div>
                ))}
              </motion.div>
            </div>

            {/* Classic Premium Indicators with Navigation */}
            <div className="flex items-center justify-center space-x-4 mt-8">
              {/* Previous Button */}
              <button
                onClick={() => {
                  const prevIndex = currentGameIndex === 0 ? upcomingGames.length - 1 : currentGameIndex - 1;
                  setCurrentGameIndex(prevIndex);
                  console.log('🎮 Manual navigation: previous to', prevIndex);
                }}
                className="p-2 rounded-full bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white transition-all duration-300"
              >
                ←
              </button>
              
              {/* Indicators */}
              <div className="flex space-x-3">
                {upcomingGames.map((game, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setCurrentGameIndex(idx);
                      console.log('🎮 Manual navigation: jumped to', idx);
                    }}
                    className={`w-3 h-3 rounded-full transition-all duration-300 ${
                      idx === currentGameIndex 
                        ? 'bg-gaming-gold scale-125 shadow-lg shadow-gaming-gold/50' 
                        : 'bg-gray-500 hover:bg-gray-400 hover:scale-110'
                    }`}
                  />
                ))}
              </div>
              
              {/* Next Button */}
              <button
                onClick={() => {
                  const nextIndex = (currentGameIndex + 1) % upcomingGames.length;
                  setCurrentGameIndex(nextIndex);
                  console.log('🎮 Manual navigation: next to', nextIndex);
                }}
                className="p-2 rounded-full bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white transition-all duration-300"
              >
                →
              </button>
            </div>

            {/* Auto-slide Toggle with Status */}
            <div className="flex flex-col items-center mt-6 space-y-2">
              <button
                onClick={() => {
                  console.log('🎮 Auto-slide toggle clicked. Current autoPlay:', autoPlay);
                  setAutoPlay(!autoPlay);
                  console.log('🎮 Auto-slide will be:', !autoPlay);
                }}
                className={`px-4 py-2 rounded-full font-gaming text-sm transition-all duration-300 ${
                  autoPlay 
                    ? 'bg-gaming-gold/20 text-gaming-gold border border-gaming-gold/50 hover:bg-gaming-gold/30' 
                    : 'bg-gray-700 text-gray-300 border border-gray-600 hover:border-gray-500 hover:bg-gray-600'
                }`}
              >
                {autoPlay ? '⏸️ Pause Auto-slide' : '▶️ Enable Auto-slide'}
              </button>
              
              {/* Status Indicator */}
              <div className="flex items-center space-x-2 text-xs">
                <div className={`w-2 h-2 rounded-full ${autoPlay ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`}></div>
                <span className="text-gray-400">
                  {autoPlay ? 'Auto-sliding active' : 'Auto-slide paused'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials - Enhanced Unique Slider */}
      <section className="py-20 bg-gaming-charcoal/30 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-gaming font-bold text-white mb-4">
              What Players Say
            </h2>
            <p className="text-gray-400 text-lg">Join thousands of satisfied gamers</p>
          </motion.div>

          {/* Enhanced Testimonials Slider */}
          <div className="relative">
            {/* Mobile: Single column, Desktop: 3 columns with animation */}
            <div className="block md:hidden">
              {/* Mobile testimonials - simple grid */}
              <div className="grid gap-6">
                {generateTestimonialsForDisplay().slice(0, 3).map((review, idx) => (
                  <motion.div
                    key={`mobile-${review.name}-${idx}`}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: idx * 0.1 }}
                    className="relative group"
                  >
                    {/* Mobile testimonial card */}
                    <div className="relative bg-gaming-charcoal/90 backdrop-blur-sm border-2 border-gray-700 rounded-3xl p-6 shadow-2xl">
                      {/* Avatar */}
                      <div className="flex items-center mb-4">
                        <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${review.color} flex items-center justify-center text-xl shadow-xl mr-3`}>
                          <GameIcon gameType={review.gameType} size="sm" />
                        </div>
                        <div>
                          <div className="font-bold text-white text-sm">{review.name}</div>
                          <div className="text-xs text-gray-400">{review.game}</div>
                        </div>
                      </div>

                      {/* Stars */}
                      <div className="flex items-center mb-4">
                        {[...Array(review.rating)].map((_, i) => (
                          <FiStar key={i} className="text-gaming-gold fill-current mr-1" size={16} />
                        ))}
                      </div>

                      {/* Review text */}
                      <p className="text-gray-300 text-sm leading-relaxed">
                        "{review.text}"
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Desktop: Simplified slider */}
            <div className="hidden md:block overflow-hidden rounded-3xl">
              <motion.div
                className="flex"
                animate={{ 
                  x: ['0%', '-33.33%', '-66.66%', '0%']
                }}
                transition={{ 
                  duration: 12,
                  repeat: Infinity,
                  ease: "linear"
                }}
              >
                {generateTestimonialsForDisplay().map((review, idx) => (
                  <div key={`desktop-${review.name}-${idx}`} className="w-1/3 flex-shrink-0 px-4">
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: (idx % 3) * 0.1 }}
                      whileHover={{ y: -10, scale: 1.02 }}
                      className="relative group h-80"
                    >
                      <div className="relative bg-gaming-charcoal/90 backdrop-blur-sm border-2 border-gray-700 group-hover:border-gaming-gold/50 rounded-3xl p-6 shadow-2xl transition-all duration-300 h-full flex flex-col">
                        
                        {/* Avatar */}
                        <div className="flex items-center mb-6">
                          <div
                            className={`w-16 h-16 rounded-full bg-gradient-to-br ${review.color} flex items-center justify-center text-3xl shadow-xl mr-4`}
                          >
                            <GameIcon gameType={review.gameType} size="md" />
                          </div>
                          <div>
                            <div className="font-bold text-white text-lg group-hover:text-gaming-gold transition-colors">
                              {review.name}
                            </div>
                            <div className="text-sm text-gray-400">{review.game}</div>
                          </div>
                        </div>

                        {/* Stars */}
                        <div className="flex items-center mb-6">
                          {[...Array(review.rating)].map((_, i) => (
                            <FiStar key={i} className="text-gaming-gold fill-current mr-1" size={20} />
                          ))}
                        </div>

                        {/* Review Text */}
                        <div className="flex-1 flex items-center">
                          <p className="text-gray-300 italic relative z-10 text-center leading-relaxed">
                            "{review.text}"
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  </div>
                ))}
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 bg-gradient-to-r from-gaming-neon/10 to-gaming-gold/10 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: 'radial-gradient(circle, #FFD700 1px, transparent 1px)',
            backgroundSize: '50px 50px'
          }}></div>
        </div>

        <div className="max-w-4xl mx-auto px-4 text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <motion.h2
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="text-3xl md:text-5xl font-gaming font-bold text-white mb-6"
            >
              Ready to Start Your Journey?
            </motion.h2>
            <p className="text-xl text-gray-300 mb-8">
              Join thousands of players competing for glory
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/register" className="btn-gaming text-lg px-8 py-4">
                Sign Up Free
              </Link>
              <Link 
                to="/tournaments" 
                className="px-8 py-4 border-2 border-gaming-gold text-gaming-gold rounded-lg hover:bg-gaming-gold hover:text-black transition-all duration-300 font-bold"
              >
                Browse Tournaments
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default CompleteLandingPage;
