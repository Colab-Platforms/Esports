import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { loginSuccess } from '../../store/slices/authSlice';
import toast from 'react-hot-toast';
import api from '../../services/api';

const OAuthSuccess = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token');
    const provider = searchParams.get('provider');

    console.log('🔐 OAuthSuccess component loaded');
    console.log('📍 Token from URL:', token ? 'Present' : 'Missing');
    console.log('📍 Provider:', provider);

    if (token) {
      const completeOAuth = async () => {
        try {
          console.log('💾 Storing token in localStorage...');
          // Store token temporarily
          localStorage.setItem('token', token);
          
          console.log('🔄 Fetching user data from /api/users/me...');
          // Fetch user data using the token
          const response = await api.get('/api/users/me');
          
          console.log('📦 API Response:', response);
          console.log('📦 Response.data:', response.data);
          console.log('📦 Response.data.user:', response.data?.user);
          
          // The API returns: { success: true, data: { user: {...} }, timestamp: '...' }
          // So we need to access response.data.user (not response.data.data.user)
          if (response.data && response.data.user) {
            const user = response.data.user;
            
            console.log('👤 User data received:', user.username);
            
            // Dispatch login success with user data
            dispatch(loginSuccess({
              token,
              user
            }));
            
            const providerName = provider === 'google' ? 'Google' : 'Steam';
            toast.success(`🎉 Successfully logged in with ${providerName}!`);
            
            console.log('🚀 Redirecting to dashboard...');
            // Redirect to dashboard
            navigate('/dashboard', { replace: true });
          } else {
            console.error('❌ Invalid response structure:', response);
            console.error('Expected response.data.user but got:', response.data);
            throw new Error('No user data received');
          }
        } catch (error) {
          console.error('❌ OAuth success error:', error);
          console.error('Error details:', error.message);
          toast.error('Authentication failed. Please try again.');
          localStorage.removeItem('token');
          navigate('/login', { replace: true });
        }
      };
      
      completeOAuth();
    } else {
      console.error('❌ No token in URL');
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