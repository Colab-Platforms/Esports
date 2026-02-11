import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import { FiEye, FiEyeOff, FiMail, FiLock, FiUser, FiPhone, FiChevronDown } from 'react-icons/fi';
import { SiCounterstrike } from 'react-icons/si';
import { IoGameController } from 'react-icons/io5';
import toast from 'react-hot-toast';
import secureRequest from '../../utils/secureRequest';

import { 
  registerStart, 
  registerSuccess, 
  registerFailure, 
  selectAuthLoading, 
  selectAuthError,
  clearError 
} from '../../store/slices/authSlice';

const RegisterPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  
  const isLoading = useSelector(selectAuthLoading);
  const error = useSelector(selectAuthError);
  
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    selectedGame: '',
    bgmiIgnName: '',
    bgmiUid: '',
    steamId: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showGameDropdown, setShowGameDropdown] = useState(false);

  // Clear error when component mounts
  useEffect(() => {
    dispatch(clearError());
  }, [dispatch]);

  // Show error toast
  useEffect(() => {
    if (error) {
      toast.error(error.message || 'Registration failed');
    }
  }, [error]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const validateForm = () => {
    if (!formData.username || !formData.email || !formData.phone || !formData.password || !formData.confirmPassword) {
      toast.error('Please fill in all fields');
      return false;
    }

    if (formData.username.length < 3) {
      toast.error('Username must be at least 3 characters');
      return false;
    }

    if (!/^[a-zA-Z0-9_ ]+$/.test(formData.username)) {
      toast.error('Username can only contain letters, numbers, spaces, and underscores');
      return false;
    }

    if (!/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(formData.email)) {
      toast.error('Please enter a valid email address');
      return false;
    }

    if (!/^(\+91)?[6-9]\d{9}$/.test(formData.phone)) {
      toast.error('Please enter a valid Indian phone number (10 digits or +91 format)');
      return false;
    }

    if (formData.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return false;
    }

    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return false;
    }

    // Validate game-specific fields
    if (formData.selectedGame === 'BGMI') {
      if (!formData.bgmiIgnName || !formData.bgmiUid) {
        toast.error('Please fill in BGMI IGN and UID');
        return false;
      }
      if (formData.bgmiUid.length < 8) {
        toast.error('BGMI UID must be at least 8 characters');
        return false;
      }
    }

    if (formData.selectedGame === 'CS2') {
      if (!formData.steamId) {
        toast.error('Please enter your Steam ID');
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    dispatch(registerStart());

    try {
      const requestData = {
        username: formData.username,
        email: formData.email,
        phone: formData.phone,
        password: formData.password
      };

      // Add game-specific data
      if (formData.selectedGame === 'BGMI') {
        requestData.bgmiIgnName = formData.bgmiIgnName;
        requestData.bgmiUid = formData.bgmiUid;
      } else if (formData.selectedGame === 'CS2') {
        requestData.gameIds = {
          steam: formData.steamId
        };
      }

      // Use secure request utility to hide sensitive data
      const data = await secureRequest.post('/api/auth/register', requestData);

      if (data.success) {
        dispatch(registerSuccess(data.data));
        toast.success('Sign up successful! Welcome to the arena! 🎮');
        navigate('/dashboard');
      } else {
        dispatch(registerFailure(data.error));
      }
    } catch (error) {
      console.error('Registration error:', error);
      dispatch(registerFailure({
        code: 'NETWORK_ERROR',
        message: 'Network error. Please check your connection.'
      }));
    }
  };

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
            Join the Arena
          </h2>
          {/* <p className="text-gray-400">
            Create your account and start your esports journey
          </p> */}
        </div>

        {/* Registration Form */}
        <motion.form
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-8 space-y-6"
          onSubmit={handleSubmit}
        >
          <div className="space-y-4">
            {/* Username Field */}
            <div>
              <label htmlFor="username" className="sr-only">
                Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FiUser className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  className="appearance-none relative block w-full px-12 py-3 border border-gaming-slate placeholder-gray-400 text-white bg-gaming-charcoal rounded-lg focus:outline-none focus:ring-2 focus:ring-gaming-neon focus:border-transparent transition-all duration-200"
                  placeholder="Username"
                  value={formData.username}
                  onChange={handleChange}
                />
              </div>
            </div>

            {/* Email Field */}
            <div>
              <label htmlFor="email" className="sr-only">
                Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FiMail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  className="appearance-none relative block w-full px-12 py-3 border border-gaming-slate placeholder-gray-400 text-white bg-gaming-charcoal rounded-lg focus:outline-none focus:ring-2 focus:ring-gaming-neon focus:border-transparent transition-all duration-200"
                  placeholder="Email address"
                  value={formData.email}
                  onChange={handleChange}
                />
              </div>
            </div>

            {/* Phone Field */}
            <div>
              <label htmlFor="phone" className="sr-only">
                Phone Number
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FiPhone className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  required
                  className="appearance-none relative block w-full px-12 py-3 border border-gaming-slate placeholder-gray-400 text-white bg-gaming-charcoal rounded-lg focus:outline-none focus:ring-2 focus:ring-gaming-neon focus:border-transparent transition-all duration-200"
                  placeholder="Phone number (10 digits or +91XXXXXXXXXX)"
                  value={formData.phone}
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
                  placeholder="Password (min 6 characters)"
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

            {/* Confirm Password Field */}
            <div>
              <label htmlFor="confirmPassword" className="sr-only">
                Confirm Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FiLock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  className="appearance-none relative block w-full px-12 py-3 border border-gaming-slate placeholder-gray-400 text-white bg-gaming-charcoal rounded-lg focus:outline-none focus:ring-2 focus:ring-gaming-neon focus:border-transparent transition-all duration-200"
                  placeholder="Confirm password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  title={showConfirmPassword ? "Hide password" : "Show password"}
                >
                  {showConfirmPassword ? (
                    <FiEyeOff className="h-5 w-5 text-gray-400 hover:text-gaming-neon transition-colors duration-200" />
                  ) : (
                    <FiEye className="h-5 w-5 text-gray-400 hover:text-gaming-neon transition-colors duration-200" />
                  )}
                </button>
              </div>
            </div>

            {/* Game Selection Dropdown */}
            <div>
              <label htmlFor="selectedGame" className="block text-sm font-medium text-gray-300 mb-2">
                Select Your Game (Optional)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <IoGameController className="h-5 w-5 text-gray-400" />
                </div>
                <button
                  type="button"
                  onClick={() => setShowGameDropdown(!showGameDropdown)}
                  className="appearance-none relative block w-full px-12 py-3 border border-gaming-slate placeholder-gray-400 text-white bg-gaming-charcoal rounded-lg focus:outline-none focus:ring-2 focus:ring-gaming-neon focus:border-transparent transition-all duration-200 text-left"
                >
                  {formData.selectedGame || 'Choose a game'}
                </button>
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <FiChevronDown className={`h-5 w-5 text-gray-400 transition-transform duration-200 ${showGameDropdown ? 'rotate-180' : ''}`} />
                </div>
                
                {/* Dropdown Menu */}
                {showGameDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute z-10 mt-2 w-full bg-gaming-charcoal border border-gaming-slate rounded-lg shadow-lg overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setFormData({ ...formData, selectedGame: '' });
                        setShowGameDropdown(false);
                      }}
                      className="w-full px-4 py-3 text-left text-gray-400 hover:bg-gaming-slate hover:text-white transition-colors duration-200 flex items-center"
                    >
                      <IoGameController className="mr-3 h-5 w-5" />
                      None
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFormData({ ...formData, selectedGame: 'BGMI', steamId: '' });
                        setShowGameDropdown(false);
                      }}
                      className="w-full px-4 py-3 text-left text-white hover:bg-gaming-slate transition-colors duration-200 flex items-center border-t border-gaming-slate"
                    >
                      <img 
                        src="https://cdn.shopify.com/s/files/1/0636/5226/6115/files/bgmi.jpg?v=1768032058" 
                        alt="BGMI"
                        className="w-6 h-6 rounded mr-3 object-cover"
                      />
                      BGMI (Battlegrounds Mobile India)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFormData({ ...formData, selectedGame: 'CS2', bgmiIgnName: '', bgmiUid: '' });
                        setShowGameDropdown(false);
                      }}
                      className="w-full px-4 py-3 text-left text-white hover:bg-gaming-slate transition-colors duration-200 flex items-center border-t border-gaming-slate"
                    >
                      <SiCounterstrike className="mr-3 h-5 w-5 text-orange-500" />
                      CS2 (Counter-Strike 2)
                    </button>
                  </motion.div>
                )}
              </div>
            </div>

            {/* BGMI Fields - Show when BGMI is selected */}
            {formData.selectedGame === 'BGMI' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-4"
              >
                {/* BGMI IGN Name */}
                <div>
                  <label htmlFor="bgmiIgnName" className="block text-sm font-medium text-gray-300 mb-2">
                    BGMI IGN (In-Game Name)
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <FiUser className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      id="bgmiIgnName"
                      name="bgmiIgnName"
                      type="text"
                      required={formData.selectedGame === 'BGMI'}
                      className="appearance-none relative block w-full px-12 py-3 border border-gaming-slate placeholder-gray-400 text-white bg-gaming-charcoal rounded-lg focus:outline-none focus:ring-2 focus:ring-gaming-neon focus:border-transparent transition-all duration-200"
                      placeholder="Enter your BGMI IGN"
                      value={formData.bgmiIgnName}
                      onChange={handleChange}
                    />
                  </div>
                </div>

                {/* BGMI UID */}
                <div>
                  <label htmlFor="bgmiUid" className="block text-sm font-medium text-gray-300 mb-2">
                    BGMI UID (User ID)
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <IoGameController className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      id="bgmiUid"
                      name="bgmiUid"
                      type="text"
                      required={formData.selectedGame === 'BGMI'}
                      className="appearance-none relative block w-full px-12 py-3 border border-gaming-slate placeholder-gray-400 text-white bg-gaming-charcoal rounded-lg focus:outline-none focus:ring-2 focus:ring-gaming-neon focus:border-transparent transition-all duration-200"
                      placeholder="Enter your BGMI UID"
                      value={formData.bgmiUid}
                      onChange={handleChange}
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {/* CS2 Steam ID Field - Show when CS2 is selected */}
            {formData.selectedGame === 'CS2' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <label htmlFor="steamId" className="block text-sm font-medium text-gray-300 mb-2">
                  Steam ID
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <SiCounterstrike className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="steamId"
                    name="steamId"
                    type="text"
                    required={formData.selectedGame === 'CS2'}
                    className="appearance-none relative block w-full px-12 py-3 border border-gaming-slate placeholder-gray-400 text-white bg-gaming-charcoal rounded-lg focus:outline-none focus:ring-2 focus:ring-gaming-neon focus:border-transparent transition-all duration-200"
                    placeholder="Enter your Steam ID"
                    value={formData.steamId}
                    onChange={handleChange}
                  />
                </div>
                <p className="mt-2 text-xs text-gray-400">
                  Find your Steam ID at{' '}
                  <a 
                    href="https://steamid.io/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-gaming-neon hover:text-gaming-neon-blue"
                  >
                    steamid.io
                  </a>
                </p>
              </motion.div>
            )}
          </div>
           
          {/* Terms and  Conditions */}
          <div className="flex items-center">
            <input
              id="terms"
              name="terms"
              type="checkbox"
              required
              title="Accept terms and conditions"
              className="h-4 w-4 text-gaming-neon focus:ring-gaming-neon border-gaming-slate rounded bg-gaming-charcoal"
            />
            <label htmlFor="terms" className="ml-2 block text-sm text-gray-400">
              I agree to the{' '}
              <Link to="/terms" title="Read terms of service" className="text-gaming-neon hover:text-gaming-neon-blue">
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link to="/privacy" title="Read privacy policy" className="text-gaming-neon hover:text-gaming-neon-blue">
                Privacy Policy
              </Link>
            </label>
          </div>

          {/* Submit Button */}
          <div>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={isLoading}
              title="Create your account"
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-gaming-dark bg-gradient-neon hover:shadow-gaming focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gaming-neon disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              {isLoading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gaming-dark mr-2"></div>
                  Creating account...
                </div>
              ) : (
                'Create Account'
              )}
            </motion.button>
          </div>

          {/* OAuth Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gaming-slate"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-gaming-dark text-gray-400">Or sign up with</span>
            </div>
          </div>

          {/* OAuth Buttons */}
          <div className="grid grid-cols-1 gap-3">
            {/* Google button disabled for now */}
            
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="button"
              onClick={async () => {
                try {
                  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';
                  // Check if OAuth is configured before redirecting
                  const response = await fetch(`${API_URL}/api/auth/google`, {
                    method: 'GET',
                    redirect: 'manual' // Don't follow redirects
                  });
                  
                  if (response.status === 503) {
                    const data = await response.json();
                    toast.error(data.error?.message || 'Google login is not available');
                    return;
                  }
                  
                  // If no error, proceed with OAuth
                  window.location.href = `${API_URL}/api/auth/google`;
                } catch (error) {
                  console.error('OAuth check error:', error);
                  // Fallback to direct redirect
                  window.location.href = `${process.env.REACT_APP_API_URL || 'http://localhost:5001'}/api/auth/google`;
                }
              }}
              className="w-full inline-flex justify-center py-2 px-4 border border-gaming-slate rounded-lg shadow-sm bg-gaming-charcoal text-sm font-medium text-white hover:bg-gaming-slate transition-all duration-200"
              title="Sign up with Google"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span className="ml-2">Google</span>
            </motion.button>
           
          </div>

          {/* Sign In Link */}
          <div className="text-center">
            <p className="text-gray-400">
              Already have an account?{' '}
              <Link
                to="/login"
                title="Sign in to your account"
                className="text-gaming-neon hover:text-gaming-neon-blue font-medium transition-colors duration-200"
              >
                Sign in
              </Link>
            </p>
          </div>
        </motion.form>
      </motion.div>
    </div>
  );
};

export default RegisterPage;