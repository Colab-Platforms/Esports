import { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { selectIsAuthenticated } from '../store/slices/authSlice';
import axios from 'axios';

const TOAST_STORAGE_KEY = 'dailyStreakToastShown';

const useDailyStreak = () => {
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const [showToast, setShowToast] = useState(false);
  const [streakData, setStreakData] = useState({ streak: 0, coins: 10 });
  const [claiming, setClaiming] = useState(false);

  const checkStreak = useCallback(async () => {
    if (!isAuthenticated) return;

    // Prevent showing toast more than once per day per session
    const lastShown = localStorage.getItem(TOAST_STORAGE_KEY);
    const today = new Date().toDateString();
    if (lastShown === today) return;

    try {
      const token = localStorage.getItem('token');
      const { data } = await axios.get('/api/wallet/streak-status', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (data.success && data.data.canClaim) {
        setStreakData({
          streak: data.data.currentStreak,
          coins: data.data.coinsToEarn
        });
        // If welcome bonus modal might be showing (new signup), wait longer
        // welcomeBonus key is set on signup and removed after modal shows
        const welcomeBonusRaw = localStorage.getItem('welcomeBonus');
        let isNewSignup = false;
        if (welcomeBonusRaw) {
          try {
            const { timestamp } = JSON.parse(welcomeBonusRaw);
            isNewSignup = Date.now() - timestamp < 5 * 60 * 1000; // within 5 mins
          } catch (e) { /* ignore */ }
        }
        const delay = isNewSignup ? 5000 : 1500;
        setTimeout(() => setShowToast(true), delay);
      }
    } catch (err) {
      // Silently fail — don't break the page
      console.error('Streak check failed:', err);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    checkStreak();
  }, [checkStreak]);

  const handleClaim = useCallback(async () => {
    setClaiming(true);
    try {
      const token = localStorage.getItem('token');
      const { data } = await axios.post('/api/wallet/daily-login', {}, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (data.success) {
        // Mark as shown today
        localStorage.setItem(TOAST_STORAGE_KEY, new Date().toDateString());
        setShowToast(false);
        return { success: true, message: data.message, coinsEarned: data.data.totalCoinsEarned };
      }
    } catch (err) {
      const code = err.response?.data?.error?.code;
      if (code === 'ALREADY_CLAIMED') {
        localStorage.setItem(TOAST_STORAGE_KEY, new Date().toDateString());
        setShowToast(false);
      }
    } finally {
      setClaiming(false);
    }
    return { success: false };
  }, []);

  const handleClose = useCallback(() => {
    localStorage.setItem(TOAST_STORAGE_KEY, new Date().toDateString());
    setShowToast(false);
  }, []);

  return { showToast, streakData, claiming, handleClaim, handleClose };
};

export default useDailyStreak;
