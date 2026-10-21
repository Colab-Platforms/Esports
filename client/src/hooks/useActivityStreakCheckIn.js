import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import api from '../services/api';
import { selectAuth, updateProfile } from '../store/slices/authSlice';

export const getActivityDayKey = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date);
  const value = type => parts.find(part => part.type === type).value;
  return `${value('year')}-${value('month')}-${value('day')}`;
};

export default function useActivityStreakCheckIn() {
  const dispatch = useDispatch();
  const { isAuthenticated, user, token } = useSelector(selectAuth);
  const userId = user?.id || user?._id;

  useEffect(() => {
    if (!isAuthenticated || !userId || !token) return undefined;
    let cancelled = false;
    let inFlight = false;
    let confirmedDay = null;
    const checkIn = async () => {
      if (cancelled || inFlight || document.visibilityState === 'hidden' || confirmedDay === getActivityDayKey()) return;
      inFlight = true;
      try {
        const response = await api.checkInActivityStreak();
        if (cancelled || !response?.success || !response.data?.checkedInToday) return;
        const { activityStreak, longestActivityStreak, totalActiveDays, lastActivityDayKey } = response.data;
        confirmedDay = lastActivityDayKey;
        dispatch(updateProfile({ activityStreak, longestActivityStreak, totalActiveDays, lastActivityDayKey }));
        window.dispatchEvent(new Event('activity-streak-updated'));
      } catch (_error) {
        // A failed request stays retryable; activity must never block navigation.
      } finally {
        inFlight = false;
      }
    };
    checkIn();
    const timer = window.setInterval(checkIn, 60000);
    window.addEventListener('focus', checkIn);
    window.addEventListener('online', checkIn);
    document.addEventListener('visibilitychange', checkIn);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener('focus', checkIn);
      window.removeEventListener('online', checkIn);
      document.removeEventListener('visibilitychange', checkIn);
    };
  }, [dispatch, isAuthenticated, token, userId]);
}
