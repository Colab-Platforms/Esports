import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { loginSuccess } from '../../store/slices/authSlice';
import toast from 'react-hot-toast';

const OAuthSuccess = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token');
    const provider = searchParams.get('provider');

    if (token) {
      // Decode token to get user data (you might want to fetch user data from API instead)
      try {
        // Store token and redirect
        const userData = {
          token,
          user: null // Will be fetched by the app
        };
        
        dispatch(loginSuccess(userData));
        
        const providerName = provider === 'google' ? 'Google' : 'Steam';
        toast.success(`🎉 Successfully logged in with ${providerName}!`);
        
        // Redirect to dashboard
        navigate('/dashboard', { replace: true });
      } catch (error) {
        console.error('OAuth success error:', error);
        toast.error('Authentication failed. Please try again.');
        navigate('/login', { replace: true });
      }
    } else {
      toast.error('Authentication failed. Please try again.');
      navigate('/login', { replace: true });
    }
  }, [searchParams, dispatch, navigate]);

  return (
    <div className="min-h-screen bg-gaming-dark flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gaming-neon mx-auto mb-4"></div>
        <p className="text-white text-lg">Completing authentication...</p>
      </div>
    </div>
  );
};

export default OAuthSuccess;