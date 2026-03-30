// TODO: Replace with dedicated activity endpoint (scrims, tournaments, member events) in a future phase

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiArrowLeft } from 'react-icons/fi';
import api from '../../services/api';
import toast from 'react-hot-toast';

const ClanActivity = () => {
  const { id: clanId } = useParams();
  const navigate = useNavigate();

  const [clan, setClan] = useState(null);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingActivity, setLoadingActivity] = useState(false);

  // Fetch clan detail
  useEffect(() => {
    fetchClanDetail();
  }, [clanId]);

  // Fetch activity (messages)
  useEffect(() => {
    if (clan) {
      fetchActivity();
    }
  }, [clan]);

  const fetchClanDetail = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/clans/${clanId}`);

      if (response.success) {
        setClan(response.data.clan);
      }
    } catch (error) {
      console.error('Error fetching clan:', error);
      toast.error('Failed to load clan');
      navigate('/clans');
    } finally {
      setLoading(false);
    }
  };

  const fetchActivity = async () => {
    try {
      setLoadingActivity(true);
      const response = await api.get(`/api/clans/${clanId}/messages?limit=20`);

      if (response.success) {
        setActivity(response.data.messages || []);
      }
    } catch (error) {
      console.error('Error fetching activity:', error);
      toast.error('Failed to load activity');
    } finally {
      setLoadingActivity(false);
    }
  };

  const getAvatarInitials = (name) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  // Loading skeleton
  const ActivitySkeleton = () => (
    <div className="space-y-4">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex gap-4 p-4 bg-gaming-charcoal border border-gaming-border rounded-lg animate-pulse">
          <div className="w-10 h-10 rounded-full bg-gaming-border flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gaming-border rounded w-1/4" />
            <div className="h-3 bg-gaming-border rounded w-3/4" />
            <div className="h-3 bg-gaming-border rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gaming-dark py-8 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gaming-border rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading clan...</p>
        </div>
      </div>
    );
  }

  if (!clan) {
    return (
      <div className="min-h-screen bg-gaming-dark py-8">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Clan not found</h1>
          <button
            onClick={() => navigate('/clans')}
            className="px-6 py-2 bg-gaming-gold text-black font-bold rounded-lg hover:bg-yellow-500 transition-colors"
          >
            Back to Clans
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gaming-dark py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Back Button */}
        <button
          onClick={() => navigate(`/clans/${clanId}`)}
          className="flex items-center gap-2 text-gaming-gold hover:text-yellow-400 mb-6 transition-colors"
        >
          <FiArrowLeft className="w-5 h-5" />
          Back to clan
        </button>

        {/* Header */}
        <div className="bg-gaming-charcoal border border-gaming-border rounded-lg p-8 mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">{clan.name}</h1>
          <p className="text-gray-400">Recent Activity</p>
        </div>

        {/* Activity Feed */}
        <div className="bg-gaming-charcoal border border-gaming-border rounded-lg overflow-hidden">
          {loadingActivity ? (
            <div className="p-6">
              <ActivitySkeleton />
            </div>
          ) : activity.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-gray-400 text-lg">No activity yet — be the first to chat!</p>
            </div>
          ) : (
            <div className="divide-y divide-gaming-border">
              {activity.map((item, index) => (
                <div
                  key={item._id || index}
                  className="flex gap-4 p-6 hover:bg-gaming-dark/50 transition-colors"
                >
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    {getAvatarInitials(item.sender?.username)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 mb-1">
                      <p className="text-sm font-semibold text-white">
                        {item.sender?.username || 'Unknown'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatTimestamp(item.createdAt)}
                      </p>
                    </div>
                    <p className="text-sm text-gray-300 break-words line-clamp-2">
                      {item.content}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClanActivity;
