import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiMail, FiArrowLeft } from 'react-icons/fi';
import toast from 'react-hot-toast';
import secureRequest from '../../utils/secureRequest';

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!email) {
      toast.error('Please enter your email address');
      return;
    }

    if (!/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(email)) {
      toast.error('Please enter a valid email address');
      return;
    }

    setLoading(true);

    try {
      // Use secure request utility
      const data = await secureRequest.post('/api/auth/forgot-password', { email });

      if (data.success) {
        setEmailSent(true);
        toast.success('Password reset email sent! Check your inbox.');
      } else {
        toast.error(data.error?.message || 'Failed to send reset email');
      }
    } catch (error) {
      console.error('Forgot password error:', error);
      toast.error('Network error. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  if (emailSent) {
    return (
      <div className="min-h-screen bg-gaming-dark flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-md w-full space-y-8"
        >
          {/* Success State */}
          <div className="text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="mx-auto w-16 h-16 bg-green-500 rounded-2xl flex items-center justify-center mb-6"
            >
              <FiMail className="text-white text-2xl" />
            </motion.div>
            <h2 className="text-3xl font-gaming font-bold text-white mb-2">
              Email Sent!
            </h2>
            <p className="text-gray-400 mb-6">
              We've sent a password reset link to <strong className="text-gaming-gold">{email}</strong>
            </p>
            <div className="bg-gaming-charcoal/50 border border-gaming-slate rounded-lg p-4 mb-6">
              <p className="text-gray-300 text-sm">
                📧 Check your email inbox (and spam folder) for the reset link.
                <br />
                🔗 Click the link in the email to reset your password.
                <br />
                ⏰ The link will expire in 1 hour.
              </p>
            </div>
            <div className="space-y-4">
              <Link
                to="/login"
                className="w-full flex justify-center py-3 px-4 border border-gaming-gold text-gaming-gold rounded-lg hover:bg-gaming-gold hover:text-black transition-all duration-200 font-medium"
              >
                Back to Login
              </Link>
              <button
                onClick={() => {
                  setEmailSent(false);
                  setEmail('');
                }}
                className="w-full text-gray-400 hover:text-gaming-gold transition-colors duration-200 text-sm"
              >
                Send to different email
              </button>
            </div>
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
            <FiMail className="text-gaming-dark text-2xl" />
          </motion.div>
          <h2 className="text-3xl font-gaming font-bold text-white mb-2">
            Forgot Password?
          </h2>
          <p className="text-gray-400">
            Enter your email address and we'll send you a link to reset your password
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
          <div>
            <label htmlFor="email" className="sr-only">
              Email address
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
                placeholder="Enter your email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
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
                  Sending email...
                </div>
              ) : (
                'Send Reset Link'
              )}
            </motion.button>
          </div>

          <div className="text-center">
            <Link
              to="/login"
              className="text-gaming-gold hover:text-gaming-neon font-medium transition-colors duration-200 flex items-center justify-center"
            >
              <FiArrowLeft className="mr-2" />
              Back to Login
            </Link>
          </div>
        </motion.form>
      </motion.div>
    </div>
  );
};

export default ForgotPasswordPage;