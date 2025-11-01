import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import api from '../../services/api';
import { 
  FiShield, 
  FiAlertTriangle, 
  FiEye, 
  FiFlag, 
  FiUsers, 
  FiActivity,
  FiTrendingUp,
  FiClock
} from 'react-icons/fi';

const SecurityDashboard = () => {
  const { user } = useSelector(state => state.auth);
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState('7d');

  useEffect(() => {
    fetchDashboardData();
  }, [selectedPeriod]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [dashboardResponse, statisticsResponse] = await Promise.all([
        api.get('/security/dashboard'),
        api.get(`/security/statistics?period=${selectedPeriod}`)
      ]);

      setDashboardData({
        ...dashboardResponse.data.data,
        statistics: statisticsResponse.data.data
      });
    } catch (error) {
      console.error('Error fetching security dashboard:', error);
      setError('Failed to load security dashboard');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
        {error}
      </div>
    );
  }

  const { security, verification, statistics } = dashboardData;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Security Dashboard</h1>
          <p className="text-gray-400">Monitor platform security and fair play</p>
        </div>
        
        <div className="flex items-center space-x-4">
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="bg-gray-800 text-white border border-gray-600 rounded-lg px-3 py-2"
          >
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="relative bg-gray-800 rounded-lg p-6 overflow-hidden">
          <div className="absolute inset-0 opacity-10">
            <img 
              src="https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=400&h=200&fit=crop&crop=center"
              alt="Security Background"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="relative z-10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Pending Reviews</p>
                <p className="text-2xl font-bold text-white">{security.pendingReviews}</p>
              </div>
              <div className="w-12 h-12 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-full flex items-center justify-center">
                <FiClock className="w-6 h-6 text-white" />
              </div>
            </div>
            <div className="mt-2">
              <span className="text-yellow-500 text-sm">Requires attention</span>
            </div>
          </div>
        </div>

        <div className="relative bg-gray-800 rounded-lg p-6 overflow-hidden">
          <div className="absolute inset-0 opacity-10">
            <img 
              src="https://images.unsplash.com/photo-1560253023-3ec5d502959f?w=400&h=200&fit=crop&crop=center"
              alt="Flagged Accounts Background"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="relative z-10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Flagged Accounts</p>
                <p className="text-2xl font-bold text-white">{security.flaggedAccounts}</p>
              </div>
              <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-pink-600 rounded-full flex items-center justify-center">
                <FiFlag className="w-6 h-6 text-white" />
              </div>
            </div>
            <div className="mt-2">
              <span className="text-red-500 text-sm">Active flags</span>
            </div>
          </div>
        </div>

        <div className="relative bg-gray-800 rounded-lg p-6 overflow-hidden">
          <div className="absolute inset-0 opacity-10">
            <img 
              src="https://images.unsplash.com/photo-1542751371-adc38448a05e?w=400&h=200&fit=crop&crop=center"
              alt="Critical Events Background"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="relative z-10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Critical Events</p>
                <p className="text-2xl font-bold text-white">{security.criticalEvents}</p>
              </div>
              <div className="w-12 h-12 bg-gradient-to-br from-red-600 to-red-800 rounded-full flex items-center justify-center">
                <FiAlertTriangle className="w-6 h-6 text-white" />
              </div>
            </div>
            <div className="mt-2">
              <span className="text-red-600 text-sm">High priority</span>
            </div>
          </div>
        </div>

        <div className="relative bg-gray-800 rounded-lg p-6 overflow-hidden">
          <div className="absolute inset-0 opacity-10">
            <img 
              src="https://images.unsplash.com/photo-1511512578047-dfb367046420?w=400&h=200&fit=crop&crop=center"
              alt="Verification Rate Background"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="relative z-10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Verification Rate</p>
                <p className="text-2xl font-bold text-white">{verification.verificationRate}%</p>
              </div>
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center">
                <FiShield className="w-6 h-6 text-white" />
              </div>
            </div>
            <div className="mt-2">
              <span className="text-green-500 text-sm">Screenshots verified</span>
            </div>
          </div>
        </div>
      </div>

      {/* Charts and Statistics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Security Events by Type */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Security Events by Type</h3>
          <div className="space-y-3">
            {statistics.securityEventsByType.map((event, index) => (
              <div key={index} className="flex items-center justify-between">
                <span className="text-gray-300 capitalize">
                  {event._id.replace('_', ' ')}
                </span>
                <div className="flex items-center space-x-2">
                  <div className="w-20 bg-gray-700 rounded-full h-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full"
                      style={{ 
                        width: `${(event.count / Math.max(...statistics.securityEventsByType.map(e => e.count))) * 100}%` 
                      }}
                    ></div>
                  </div>
                  <span className="text-white font-medium w-8 text-right">{event.count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Security Events by Severity */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Events by Severity</h3>
          <div className="space-y-3">
            {statistics.securityEventsBySeverity.map((severity, index) => {
              const colors = {
                low: 'bg-green-500',
                medium: 'bg-yellow-500',
                high: 'bg-orange-500',
                critical: 'bg-red-500'
              };
              
              return (
                <div key={index} className="flex items-center justify-between">
                  <span className="text-gray-300 capitalize">{severity._id}</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-20 bg-gray-700 rounded-full h-2">
                      <div 
                        className={`${colors[severity._id]} h-2 rounded-full`}
                        style={{ 
                          width: `${(severity.count / Math.max(...statistics.securityEventsBySeverity.map(s => s.count))) * 100}%` 
                        }}
                      ></div>
                    </div>
                    <span className="text-white font-medium w-8 text-right">{severity.count}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Recent Security Events</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="pb-3 text-gray-400 font-medium">Time</th>
                <th className="pb-3 text-gray-400 font-medium">User</th>
                <th className="pb-3 text-gray-400 font-medium">Event</th>
                <th className="pb-3 text-gray-400 font-medium">Severity</th>
                <th className="pb-3 text-gray-400 font-medium">Description</th>
              </tr>
            </thead>
            <tbody>
              {statistics.recentActivity.map((event, index) => (
                <tr key={index} className="border-b border-gray-700">
                  <td className="py-3 text-gray-300">
                    {new Date(event.createdAt).toLocaleString()}
                  </td>
                  <td className="py-3 text-white">
                    {event.userId?.username || 'Unknown'}
                  </td>
                  <td className="py-3">
                    <span className="px-2 py-1 bg-blue-600 text-blue-100 rounded text-sm">
                      {event.eventType.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="py-3">
                    <span className={`px-2 py-1 rounded text-sm ${
                      event.severity === 'critical' ? 'bg-red-600 text-red-100' :
                      event.severity === 'high' ? 'bg-orange-600 text-orange-100' :
                      event.severity === 'medium' ? 'bg-yellow-600 text-yellow-100' :
                      'bg-green-600 text-green-100'
                    }`}>
                      {event.severity}
                    </span>
                  </td>
                  <td className="py-3 text-gray-300 max-w-xs truncate">
                    {event.description}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <button className="bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-lg flex items-center space-x-3 transition-colors">
          <FiEye className="w-5 h-5" />
          <span>Review Flagged Accounts</span>
        </button>
        
        <button className="bg-green-600 hover:bg-green-700 text-white p-4 rounded-lg flex items-center space-x-3 transition-colors">
          <FiShield className="w-5 h-5" />
          <span>Screenshot Verifications</span>
        </button>
        
        <button className="bg-purple-600 hover:bg-purple-700 text-white p-4 rounded-lg flex items-center space-x-3 transition-colors">
          <FiActivity className="w-5 h-5" />
          <span>Security Logs</span>
        </button>
      </div>
    </div>
  );
};

export default SecurityDashboard;