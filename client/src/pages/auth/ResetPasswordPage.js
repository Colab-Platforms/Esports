import React, { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiLock, FiEye, FiEyeOff, FiCheck } from 'react-icons/fi';
import toast from 'react-hot-toast';
import secureRequest from '../../utils/secureRequest';

const ResetPasswordPage = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tokenValid, setTokenValid] = useState(null);
  const [resetSuccess, setResetSuccess] = useState(false);

  // Verify token on component mount
  useEffect(() => {
    verifyToken();
  }, [token]);

  const verifyToken = async () => {
    try {
      // Use secure request utility
      const data = await secureRequest.get(`/api/auth/verify-reset-token/${token}`);
      
      setTokenValid(data.success);
      if (!data.success) {
        toast.error(data.error?.message || 'Invalid or expired reset token');
      }
    } catch (error) {
      console.error('Token verification error:', error);
      setTokenValid(false);
      toast.error('Failed to verify reset token');
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const validateForm = () => {
    if (!formData.password || !formData.confirmPassword) {
      toast.error('Please fill in all fields');
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

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setLoading(true);

    try {
      // Use secure request utility
      const data = await secureRequest.post('/api/auth/reset-password', {
        token,
        password: formData.password
      });

      if (data.success) {
        setResetSuccess(true);
        toast.success('Password reset successful!');
        setTimeout(() => {
          navigate('/login');
        }, 3000);
      } else {
        toast.error(data.error?.message || 'Failed to reset password');
      }
    } catch (error) {
      console.error('Reset password error:', error);
      toast.error('Network error. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  // Loading state
  if (tokenValid === null) {
    return (
      <div className="min-h-screen bg-gaming-dark flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gaming-gold mx-auto mb-4"></div>
          <p className="text-gray-400">Verifying reset token...</p>
        </div>
      </div>
    );
  }

  // Invalid token state
  if (tokenValid === false) {
    return (
      <div className="min-h-screen bg-gaming-dark flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-md w-full space-y-8"
        >
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-red-500 rounded-2xl flex items-center justify-center mb-6">
              <span className="text-white text-2xl">❌</span>
            </div>
            <h2 className="text-3xl font-gaming font-bold text-white mb-2">
              Invalid Reset Link
            </h2>
            <p className="text-gray-400 mb-6">
              This password reset link is invalid or has expired.
            </p>
            <div className="space-y-4">
              <Link
                to="/forgot-password"
                className="w-full flex justify-center py-3 px-4 border border-gaming-gold text-gaming-gold rounded-lg hover:bg-gaming-gold hover:text-black transition-all duration-200 font-medium"
              >
                Request New Reset Link
              </Link>
              <Link
                to="/login"
                className="w-full text-gray-400 hover:text-gaming-gold transition-colors duration-200 text-sm"
              >
                Back to Login
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // Success state
  if (resetSuccess) {
    return (
      <div className="min-h-screen bg-gaming-dark flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-md w-full space-y-8"
        >
          <div className="text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="mx-auto w-16 h-16 bg-green-500 rounded-2xl flex items-center justify-center mb-6"
            >
              <FiCheck className="text-white text-2xl" />
            </motion.div>
            <h2 className="text-3xl font-gaming font-bold text-white mb-2">
              Password Reset!
            </h2>
            <p className="text-gray-400 mb-6">
              Your password has been successfully reset. You can now login with your new password.
            </p>
            <div className="bg-gaming-charcoal/50 border border-gaming-slate rounded-lg p-4 mb-6">
              <p className="text-gray-300 text-sm">
                🔄 Redirecting to login page in 3 seconds...
              </p>
            </div>
            <Link
              to="/login"
              className="w-full flex justify-center py-3 px-4 border border-gaming-gold text-gaming-gold rounded-lg hover:bg-gaming-gold hover:text-black transition-all duration-200 font-medium"
            >
              Go to Login
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gaming-dark flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
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
            className="mx-auto w-16 h-16 bg-gradient-neon rounded-2xl flex items-center justify-center mb-6"
          >
            <FiLock className="text-gaming-dark text-2xl" />
          </motion.div>
          <h2 className="text-3xl font-gaming font-bold text-white mb-2">
            Reset Password
          </h2>
          <p className="text-gray-400">
            Enter your new password below
          </p>
        </div>

        {/* Form */}
        <motion.form
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-8 space-y-6"
          onSubmit={handleSubmit}
        >
          <div className="space-y-4">
            {/* Password Field */}
            <div>
              <label htmlFor="password" className="sr-only">
                New Password
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
                  placeholder="New password (min 6 characters)"
                  value={formData.password}
                  onChange={handleChange}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
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
                Confirm New Password
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
                  placeholder="Confirm new password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <FiEyeOff className="h-5 w-5 text-gray-400 hover:text-gaming-neon transition-colors duration-200" />
                  ) : (
                    <FiEye className="h-5 w-5 text-gray-400 hover:text-gaming-neon transition-colors duration-200" />
                  )}
                </button>
              </div>
            </div>
          </div>

          <div>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-gaming-dark bg-gradient-neon hover:shadow-gaming focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gaming-neon disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              {loading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gaming-dark mr-2"></div>
                  Resetting password...
                </div>
              ) : (
                'Reset Password'
              )}
            </motion.button>
          </div>

          <div className="text-center">
            <Link
              to="/login"
              className="text-gaming-gold hover:text-gaming-neon font-medium transition-colors duration-200"
            >
              Back to Login
            </Link>
          </div>
        </motion.form>
      </motion.div>
    </div>
  );
};

export default ResetPasswordPage;