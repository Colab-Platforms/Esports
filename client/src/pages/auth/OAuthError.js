import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';

const OAuthError = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const message = searchParams.get('message') || 'Authentication failed';
    toast.error(message);
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-gaming-dark flex items-center justify-center py-12 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full text-center"
      >
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-8">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-white mb-4">Authentication Failed</h2>
          <p className="text-gray-400 mb-6">
            {searchParams.get('message') || 'Something went wrong during authentication. Please try again.'}
          </p>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate('/login')}
            className="w-full py-3 px-4 bg-gradient-neon text-gaming-dark font-medium rounded-lg hover:shadow-gaming transition-all duration-200"
          >
            Back to Login
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
};

export default OAuthError;