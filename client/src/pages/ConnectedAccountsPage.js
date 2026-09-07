import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import { FiCheck, FiAlertCircle } from 'react-icons/fi';
import toast from 'react-hot-toast';
import api from '../services/api';
import { AUTH_PROVIDERS } from '../config/authProviders';
import ProviderLoginButton from '../components/auth/ProviderLoginButton';

const CONNECT_ERROR_MESSAGES = {
  auth_failed: 'Authentication failed. Please try again.',
  already_linked: 'That account is already connected to a different Colab Esports account.',
  connect_failed: 'Something went wrong connecting that account. Please try again.',
  connect_expired: 'Your connection attempt expired. Please try again.',
  connect_not_started: 'Please start the connection from this page rather than visiting that link directly.'
};

const ConnectedAccountsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState('');

  const fetchAccounts = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/accounts');
      setAccounts((response.data && response.data.accounts) || []);
    } catch (error) {
      console.error('Error fetching connected accounts:', error);
      toast.error('Failed to load connected accounts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  // Handle the redirect back from a provider's connect flow
  // (?connected=<provider> or ?connect_error=<reason>) once, then clean the URL.
  useEffect(() => {
    const connected = searchParams.get('connected');
    const connectError = searchParams.get('connect_error');

    if (connected) {
      const provider = AUTH_PROVIDERS.find((p) => p.id === connected);
      toast.success(`${provider ? provider.label : connected} connected successfully!`);
      fetchAccounts();
    } else if (connectError) {
      toast.error(CONNECT_ERROR_MESSAGES[connectError] || 'Failed to connect that account.');
    }

    if (connected || connectError) {
      searchParams.delete('connected');
      searchParams.delete('connect_error');
      setSearchParams(searchParams, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDisconnect = async (providerId, label) => {
    if (!window.confirm(`Disconnect your ${label} account?`)) return;

    try {
      setDisconnecting(providerId);
      await api.post(`/api/accounts/${providerId}/disconnect`);
      toast.success(`${label} disconnected.`);
      await fetchAccounts();
    } catch (error) {
      toast.error(error.message || `Failed to disconnect ${label}`);
    } finally {
      setDisconnecting('');
    }
  };

  const findAccount = (providerId) => accounts.find((account) => account.provider === providerId);

  if (loading) {
    return (
      <div className="min-h-screen bg-gaming-dark flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gaming-gold mx-auto mb-4"></div>
          <p className="text-gray-300">Loading connected accounts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gaming-dark py-8 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl mx-auto"
      >
        <h1 className="text-2xl font-bold text-white mb-2">Connected Accounts</h1>
        <p className="text-gray-400 mb-8">
          Manage which external accounts can sign you in to Colab Esports.
        </p>

        <div className="space-y-4">
          {AUTH_PROVIDERS.map(({ id, label, icon: Icon, brandColor }) => {
            const account = findAccount(id);

            return (
              <div
                key={id}
                className="bg-gaming-card rounded-xl border border-gaming-border p-4 flex items-center justify-between"
              >
                <div className="flex items-center space-x-4">
                  <div className="relative w-10 h-10 rounded-full bg-gaming-slate flex items-center justify-center">
                    {account && account.avatarUrl ? (
                      <img
                        src={account.avatarUrl}
                        alt={label}
                        className="w-10 h-10 rounded-full object-cover"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    ) : (
                      <Icon className="w-5 h-5" style={{ color: brandColor }} />
                    )}
                  </div>
                  <div>
                    <div className="text-white font-semibold">{label}</div>
                    {account ? (
                      <div className="text-green-400 text-sm flex items-center">
                        <FiCheck className="h-3 w-3 mr-1" />
                        Connected{account.displayName ? ` as ${account.displayName}` : ''}
                      </div>
                    ) : (
                      <div className="text-gray-500 text-sm flex items-center">
                        <FiAlertCircle className="h-3 w-3 mr-1" />
                        Not connected
                      </div>
                    )}
                  </div>
                </div>

                {account ? (
                  <button
                    onClick={() => handleDisconnect(id, label)}
                    disabled={disconnecting === id}
                    className="px-4 py-2 text-sm bg-gaming-slate hover:bg-red-500/20 hover:text-red-400 text-white rounded-lg transition-colors disabled:opacity-50"
                  >
                    {disconnecting === id ? 'Disconnecting...' : 'Disconnect'}
                  </button>
                ) : (
                  <div className="w-40">
                    <ProviderLoginButton provider={id} mode="connect" redirectPath="/connected-accounts" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
};

export default ConnectedAccountsPage;
