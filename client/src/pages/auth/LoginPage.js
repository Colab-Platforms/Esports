import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import { FiEye, FiEyeOff, FiMail, FiLock, FiUser, FiPhone } from 'react-icons/fi';
import toast from 'react-hot-toast';
import secureRequest from '../../utils/secureRequest';
import ProviderLoginButton from '../../components/auth/ProviderLoginButton';

import { 
  loginStart, 
  loginSuccess, 
  loginFailure, 
  selectAuthLoading, 
  selectAuthError,
  clearError 
} from '../../store/slices/authSlice';

const LoginPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  
  const isLoading = useSelector(selectAuthLoading);
  const error = useSelector(selectAuthError);
  
  const [formData, setFormData] = useState(() => {
    // Load saved form data from localStorage (except password for security)
    const savedData = localStorage.getItem('loginFormData');
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        return {
          identifier: parsed.identifier || '',
          password: '' // Never save password
        };
      } catch (error) {
        console.error('Error parsing saved form data:', error);
      }
    }
    return {
      identifier: '',
      password: ''
    };
  });
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => {
    const saved = localStorage.getItem('rememberMe');
    return saved ? JSON.parse(saved) : false;
  });

  // Clear error when component mounts
  useEffect(() => {
    dispatch(clearError());
  }, [dispatch]);

  // Clear form data when user successfully logs out (optional cleanup)
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Only clear if user is not authenticated and didn't check remember me
      if (!rememberMe) {
        localStorage.removeItem('loginFormData');
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [rememberMe]);

  // Show error toast and focus password field on error
  useEffect(() => {
    if (error) {
      toast.error(error.message || 'Login failed');
      // Focus password field after error so user can quickly correct it
      const passwordField = document.getElementById('password');
      if (passwordField) {
        setTimeout(() => passwordField.focus(), 100);
      }
    }
  }, [error]);

  const handleChange = (e) => {
    const newFormData = {
      ...formData,
      [e.target.name]: e.target.value
    };
    setFormData(newFormData);
    
    // Save identifier to localStorage (but not password for security)
    if (e.target.name === 'identifier') {
      localStorage.setItem('loginFormData', JSON.stringify({
        identifier: e.target.value
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.identifier || !formData.password) {
      toast.error('Please fill in all fields');
      return;
    }

    dispatch(loginStart());

    try {
      // Use secure request utility to hide sensitive data
      const data = await secureRequest.post('/api/auth/login', {
        ...formData,
        rememberMe
      });

      if (data.success) {
        dispatch(loginSuccess(data.data));
        const toastId = toast.success(
          (t) => (
            <span onClick={() => toast.dismiss(t.id)} style={{ cursor: 'pointer' }}>
              {data.message || 'Login successful!'}
            </span>
          ),
          { duration: 5000 }
        );
        
        // Clear saved form data on successful login
        localStorage.removeItem('loginFormData');
        
        // Redirect to intended page or dashboard
        const from = location.state?.from?.pathname || '/dashboard';
        navigate(from, { replace: true });
      } else {
        dispatch(loginFailure(data.error));
        // Don't clear form data on failure - let user edit and retry
      }
    } catch (error) {
      console.error('Login error:', error);
      dispatch(loginFailure({
        code: 'NETWORK_ERROR',
        message: 'Network error. Please check your connection.'
      }));
    }
  };

  const getIdentifierIcon = () => {
    const identifier = formData.identifier.toLowerCase();
    if (identifier.includes('@')) return FiMail;
    if (/^\d/.test(identifier)) return FiPhone;
    return FiUser;
  };

  const IdentifierIcon = getIdentifierIcon();

  return (
    <div className="h-screen bg-gaming-dark flex items-center justify-center px-4 sm:px-6 lg:px-8 overflow-hidden">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-md w-full space-y-8"
      >
        {/* Header */}
        <div className="text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="mx-auto flex flex-col items-center space-y-3 mb-6"
          >
            {/* Logo */}
            <div className="w-16 h-16 flex items-center justify-center">
              <img 
                src="https://cdn.shopify.com/s/files/1/0636/5226/6115/files/Without_Text_Infinity_Logo.png?v=1766727294" 
                alt="Infinity Logo"
                className="w-full h-full object-contain"
                style={{ filter: 'hue-rotate(45deg) saturate(1.5) brightness(1.2)' }}
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'block';
                }}
              />
              <span className="hidden text-yellow-400 font-bold text-2xl">∞</span>
            </div>
          </motion.div>
          <h2 className="text-3xl font-gaming font-bold text-white mb-2">
            Welcome Back
          </h2>
          <p className="text-gray-400">
            Sign in to your account and start dominating
          </p>
        </div>

        {/* Login Form */}
        <motion.form
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-8 space-y-6"
          onSubmit={handleSubmit}
        >
          <div className="space-y-4">
            {/* Identifier Field */}
            <div>
              <label htmlFor="identifier" className="sr-only">
                Email, Username, or Phone
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <IdentifierIcon className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="identifier"
                  name="identifier"
                  type="text"
                  required
                  className="appearance-none relative block w-full px-12 py-3 border border-gaming-slate placeholder-gray-400 text-white bg-gaming-charcoal rounded-lg focus:outline-none focus:ring-2 focus:ring-gaming-neon focus:border-transparent transition-all duration-200"
                  placeholder="Email, Username, or Phone"
                  value={formData.identifier}
                  onChange={handleChange}
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FiLock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  className="appearance-none relative block w-full px-12 py-3 border border-gaming-slate placeholder-gray-400 text-white bg-gaming-charcoal rounded-lg focus:outline-none focus:ring-2 focus:ring-gaming-neon focus:border-transparent transition-all duration-200"
                  placeholder="Password"
                  value={formData.password}
                  onChange={handleChange}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <FiEyeOff className="h-5 w-5 text-gray-400 hover:text-gaming-neon transition-colors duration-200" />
                  ) : (
                    <FiEye className="h-5 w-5 text-gray-400 hover:text-gaming-neon transition-colors duration-200" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Remember Me & Forgot Password */}
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <input
                id="remember-me"
                name="remember-me"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setRememberMe(checked);
                  localStorage.setItem('rememberMe', JSON.stringify(checked));
                }}
                className="h-4 w-4 text-gaming-neon focus:ring-gaming-neon border-gaming-slate rounded bg-gaming-charcoal"
              />
              <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-400">
                Remember me
              </label>
            </div>

            {/* Forgot Password - Temporarily disabled until SendGrid is configured */}
            <div className="text-sm">
              <Link
                to="/forgot-password"
                title="Reset your password"
                className="text-gaming-neon hover:text-gaming-neon-blue transition-colors duration-200"
              >
                Forgot password?
              </Link>
            </div>
          </div>

          {/* Submit Button */}
          <div>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={isLoading}
              title="Sign in to your account"
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-gaming-dark bg-gradient-neon hover:shadow-gaming focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gaming-neon disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              {isLoading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gaming-dark mr-2"></div>
                  Signing in...
                </div>
              ) : (
                'Sign in'
              )}
            </motion.button>
          </div>

          {/* OAuth Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gaming-slate"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-gaming-dark text-gray-400">Or continue with</span>
            </div>
          </div>

          {/* OAuth Buttons */}
          <div className="grid grid-cols-1 gap-3">
            <ProviderLoginButton provider="google" mode="login" />
            <ProviderLoginButton provider="facebook" mode="login" />
            <ProviderLoginButton provider="steam" mode="login" />
            <ProviderLoginButton provider="xbox" mode="login" />
          </div>

          {/* Sign Up Link */}
          <div className="text-center">
            <p className="text-gray-400">
              Don't have an account?{' '}
              <Link
                to="/register"
                title="Create a new account"
                className="text-gaming-neon hover:text-gaming-neon-blue font-medium transition-colors duration-200"
              >
                Sign up
              </Link>
            </p>
          </div>
        </motion.form>
      </motion.div>
    </div>
  );
};

export default LoginPage;