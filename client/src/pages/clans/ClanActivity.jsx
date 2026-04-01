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

  if (loading) return null;

  return (
    <div className="flex-1 overflow-y-auto px-4 lg:px-8 py-6 custom-scrollbar bg-hub-content-bg">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-gaming font-bold text-white mb-1">Activity Feed</h1>
          <p className="text-xs text-gray-400 uppercase tracking-widest font-bold">Latest events in <span className="text-gaming-gold">{clan?.name}</span></p>
        </div>

        <div className="space-y-4">
          {loadingActivity ? (
            <ActivitySkeleton />
          ) : activity.length === 0 ? (
            <div className="glass-panel p-20 text-center">
              <p className="text-gray-500 italic">No recent activity found.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activity.map((item, index) => (
                <div
                  key={item._id || index}
                  className="glass-card p-4 flex gap-4 items-center hover:border-white/10 transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-gaming-gold font-bold text-xs">
                    {getAvatarInitials(item.sender?.username)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between mb-1">
                      <p className="text-sm font-bold text-white">
                        {item.sender?.username || 'System'}
                      </p>
                      <span className="text-[10px] text-gray-500 font-bold uppercase tracking-tighter">
                        {formatTimestamp(item.createdAt)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 truncate">
                      Sent a message: <span className="text-gray-300">"{item.content}"</span>
                    </p>
                  </div>
                  
                  <button 
                    onClick={() => navigate(`/clans/${clanId}/chat`)}
                    className="text-[10px] font-bold text-gaming-gold/60 hover:text-gaming-gold uppercase tracking-widest px-3 py-1 rounded border border-gaming-gold/20 hover:bg-gaming-gold/5 transition-all"
                  >
                    View Chat
                  </button>
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
