import { useCallback, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import api from '../services/api';
import { selectAuth, updateProfile } from '../store/slices/authSlice';

const TIMEZONE = 'Asia/Kolkata';

const getActivityDayKey = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return `${values.year}-${values.month}-${values.day}`;
};

const useActivityStreakCheckIn = () => {
  const dispatch = useDispatch();
  const { isAuthenticated, user, token } = useSelector(selectAuth);
  const userId = user?.id || user?._id;

  const checkIn = useCallback(async () => {
    if (!isAuthenticated || !token || !userId) return;

    const todayKey = getActivityDayKey();
    const storageKey = `activityStreakCheckIn:${userId}`;

    if (localStorage.getItem(storageKey) === todayKey) {
      return;
    }

    try {
      const response = await api.checkInActivityStreak();

      if (response.success && response.data?.checkedInToday) {
        localStorage.setItem(storageKey, response.data.lastActivityDayKey || todayKey);
        dispatch(updateProfile({
          activityStreak: response.data.activityStreak,
          longestActivityStreak: response.data.longestActivityStreak,
          totalActiveDays: response.data.totalActiveDays,
          lastActivityDayKey: response.data.lastActivityDayKey
        }));
      }
    } catch (error) {
      console.error('Activity streak check-in failed:', error);
    }
  }, [dispatch, isAuthenticated, token, userId]);

  useEffect(() => {
    checkIn();
  }, [checkIn]);
};

export default useActivityStreakCheckIn;
