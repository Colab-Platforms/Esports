// Utility to refresh user data from API and update Redux store
import { updateProfile } from '../store/slices/authSlice';

export const refreshUserData = async (dispatch) => {
  try {
    const token = localStorage.getItem('token');
    if (!token) return false;

    const API_URL = process.env.REACT_APP_API_URL || '';
    const response = await fetch(`${API_URL}/api/auth/me`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (response.ok) {
      const data = await response.json();
      if (data.success && data.user) {
        // Update Redux store
        dispatch(updateProfile(data.user));
        
        // Update localStorage
        localStorage.setItem('user', JSON.stringify(data.user));
        
        console.log('✅ User data refreshed:', data.user);
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.error('❌ Failed to refresh user data:', error);
    return false;
  }
};
