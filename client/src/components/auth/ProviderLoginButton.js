import React from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { getProviderConfig } from '../../config/authProviders';
import { startProviderConnect } from '../../utils/apiConfig';

/**
 * One button, works for any provider in config/authProviders.js, in either
 * of two modes:
 *   - "login" (default): the pre-flight 503 check + redirect pattern
 *     LoginPage.js's Google button already used, generalized to any
 *     provider and any `/api/auth/:provider` route.
 *   - "connect": for an already-authenticated settings page - starts the
 *     session-based connect-intent flow (see apiConfig.js's
 *     startProviderConnect and the server-side account-linking service).
 */
const ProviderLoginButton = ({ provider, mode = 'login', redirectPath = '', label }) => {
  const config = getProviderConfig(provider);
  if (!config) return null;

  const Icon = config.icon;
  const buttonLabel = label || (mode === 'connect' ? `Connect ${config.label}` : config.label);

  const handleLogin = async () => {
    const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';
    try {
      // Check if this provider is configured before redirecting, same
      // pre-flight pattern already used for Google.
      const response = await fetch(`${API_URL}/api/auth/${provider}`, {
        method: 'GET',
        redirect: 'manual'
      });

      if (response.status === 503) {
        const data = await response.json();
        toast.error(data.error?.message || `${config.label} login is not available`);
        return;
      }

      window.location.href = `${API_URL}/api/auth/${provider}`;
    } catch (error) {
      console.error('OAuth check error:', error);
      window.location.href = `${API_URL}/api/auth/${provider}`;
    }
  };

  const handleConnect = async () => {
    try {
      await startProviderConnect(provider, redirectPath);
    } catch (error) {
      toast.error(`Failed to start ${config.label} connection. Please try again.`);
    }
  };

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      type="button"
      onClick={mode === 'connect' ? handleConnect : handleLogin}
      title={buttonLabel}
      className="w-full inline-flex items-center justify-center py-2 px-4 border border-gaming-slate rounded-lg shadow-sm bg-gaming-charcoal text-sm font-medium text-white hover:bg-gaming-slate transition-all duration-200"
    >
      <Icon className="w-5 h-5" style={{ color: config.brandColor }} />
      <span className="ml-2">{buttonLabel}</span>
    </motion.button>
  );
};

export default ProviderLoginButton;
