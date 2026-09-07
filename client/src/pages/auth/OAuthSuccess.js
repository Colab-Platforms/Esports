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
    const code = searchParams.get('code');
    const legacyToken = searchParams.get('token'); // still used by Steam until Phase 4 of the auth migration
    const provider = searchParams.get('provider');

    const finishLogin = async (token) => {
      try {
        // Store token temporarily so the /api/users/me call below is authenticated
        localStorage.setItem('token', token);

        const response = await api.get('/api/users/me');

        // The API returns: { success: true, data: { user: {...} }, timestamp: '...' }
        if (response.data && response.data.user) {
          const user = response.data.user;

          dispatch(loginSuccess({ token, user }));
          toast.success(`🎉 Welcome back, ${user.username}!`);
          navigate('/', { replace: true });
        } else {
          throw new Error('No user data received');
        }
      } catch (error) {
        console.error('❌ OAuth success error:', error.message);
        toast.error('Authentication failed. Please try again.');
        localStorage.removeItem('token');
        navigate('/login', { replace: true });
      }
    };

    if (code) {
      // New flow: exchange the one-time code for a JWT server-side, so the
      // token itself never travels through the URL/browser history.
      api.post('/api/auth/exchange', { code, provider })
        .then((response) => {
          const token = response.data && response.data.token;
          if (!token) throw new Error('No token received from exchange');
          return finishLogin(token);
        })
        .catch((error) => {
          console.error('❌ OAuth code exchange failed:', error.message);
          toast.error('Your login link expired or was already used. Please try again.');
          navigate('/login', { replace: true });
        });
    } else if (legacyToken) {
      finishLogin(legacyToken);
    } else {
      console.error('❌ No code or token in URL');
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