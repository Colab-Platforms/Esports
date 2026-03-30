import { useSelector } from 'react-redux';
import { selectAuth } from '../store/slices/authSlice';

/**
 * Hook to access current user authentication state
 * @returns {Object} { user, token, isAuthenticated }
 */
export const useAuth = () => {
  const { user, token, isAuthenticated } = useSelector(selectAuth);
  
  return {
    user,
    token,
    isAuthenticated
  };
};

export default useAuth;
