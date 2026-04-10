import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { FiArrowLeft, FiUsers, FiAlertCircle, FiSettings, FiShield, FiSlash, FiSearch, FiX, FiChevronDown } from 'react-icons/fi';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { selectAuth } from '../../store/slices/authSlice';

const ClanAdmin = () => {
  const { id: clanId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab');
  const { user, isAuthenticated } = useSelector(selectAuth);

  const [clan, setClan] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [activeTab, setActiveTab] = useState(tabFromUrl || 'members');

  useEffect(() => {
    // Debug: Log Redux state
    console.log('🔍 ClanAdmin useEffect triggered');
    console.log('📱 User from Redux:', user);
    console.log('🔐 isAuthenticated:', isAuthenticated);
    console.log('🆔 User ID (_id):', user?._id);
    console.log('🆔 User ID (id):', user?.id);
    
    // Get user ID - could be _id or id
    const userId = user?._id || user?.id;
    
    // Only fetch if user has ID (either authenticated or has user data)
    if (userId) {
      console.log('✅ User ID found:', userId, 'fetching clan data');
      fetchClanAndCheckAccess();
    } else if (!isAuthenticated && !user) {
      // User not authenticated and no user data, redirect to login
      console.warn('⚠️ User not authenticated, redirecting to login');
      navigate('/login');
    } else {
      console.warn('⚠️ Waiting for user data to load');
    }
  }, [clanId, user, isAuthenticated, navigate]);

  useEffect(() => {
    if (tabFromUrl) setActiveTab(tabFromUrl);
  }, [tabFromUrl]);

  const fetchClanAndCheckAccess = async () => {
    try {
      setLoading(true);
      
      // Get user ID - could be _id or id
      const userId = user?._id || user?.id;
      
      // Double-check user is authenticated
      if (!userId) {
        console.error('❌ User not authenticated or missing ID', { user, isAuthenticated });
        console.log('📱 User from Redux:', user);
        console.log('🔐 Is Authenticated:', isAuthenticated);
        setAccessDenied(true);
        return;
      }

      console.log('✅ User authenticated:', userId);

      const clanRes = await api.get(`/api/clans/${clanId}`);
      if (clanRes.success) {
        setClan(clanRes.data.clan);
      }

      // Fetch all members to find current user's role
      const membersRes = await api.get(`/api/clans/${clanId}/members?limit=100`);
      if (membersRes.success) {
        console.log('📋 Members fetched:', membersRes.data.members.length);
        console.log('👤 Current user ID:', userId);
        
        // Compare user IDs - handle both string and ObjectId formats
        const userMember = membersRes.data.members.find(m => {
          const memberId = m.user._id?.toString() || m.user._id;
          const userIdStr = userId?.toString() || userId;
          return memberId === userIdStr;
        });

        if (userMember) {
          console.log('✅ User found in clan with role:', userMember.role);
          setUserRole(userMember.role);
          if (!['owner', 'admin', 'mod'].includes(userMember.role)) {
            console.warn('⚠️ User role not authorized for admin panel:', userMember.role);
            setAccessDenied(true);
          }
        } else {
          console.error('❌ User not found in clan members list');
          console.log('Available members:', membersRes.data.members.map(m => m.user._id));
          setAccessDenied(true);
        }
      }
    } catch (error) {
      console.error('Error fetching clan:', error);
      toast.error('Failed to load clan');
      navigate(`/clans/${clanId}`);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  if (loading) return null;

  if (accessDenied) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-hub-content-bg h-full">
        <FiAlertCircle className="w-16 h-16 text-red-500 mb-4" />
        <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
        <p className="text-gray-400 mb-6 text-center max-w-md">You don't have permission to access the management panel for this clan.</p>
        <button onClick={() => navigate(`/clans/${clanId}`)} className="btn-premium">Return to Overview</button>
      </div>
    );
  }

  return (
    <div className="flex-1 px-4 lg:px-8 py-6 bg-hub-content-bg">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h1 className="text-3xl font-gaming font-bold text-white mb-1">Management</h1>
            <p className="text-xs text-gray-400 uppercase tracking-widest font-bold">Role — <span className="text-gaming-gold">{userRole}</span></p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-1">
            <div className="glass-panel overflow-hidden sticky top-8">
              <nav className="flex flex-col">
                {[
                  { id: 'members', label: 'Members', icon: FiUsers },
                  { id: 'reports', label: 'Reports', icon: FiAlertCircle },
                  { id: 'settings', label: 'Settings', icon: FiSettings },
                  { id: 'roles', label: 'Roles', icon: FiShield },
                  { id: 'bans', label: 'Ban List', icon: FiSlash },
                  { id: 'audit', label: 'Audit Log', icon: FiAlertCircle }
                ].map(item => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleTabChange(item.id)}
                      className={`flex items-center gap-3 px-6 py-4 border-b border-white/5 transition-all text-sm font-bold relative ${
                        activeTab === item.id
                          ? 'text-gaming-gold bg-white/5'
                          : 'text-gray-400 hover:text-white hover:bg-white/2'
                      }`}
                    >
                      {activeTab === item.id && (
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gaming-gold shadow-[0_0_8px_rgba(241,196,15,0.5)]" />
                      )}
                      <Icon className="w-5 h-5" />
                      <span className="flex-1 text-left">{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>

          <div className="lg:col-span-3">
            {activeTab === 'members' && <MembersTab clanId={clanId} userRole={userRole} />}
            {activeTab === 'reports' && <ReportsTab clanId={clanId} />}
            {activeTab === 'settings' && <SettingsTab clanId={clanId} clan={clan} setClan={setClan} user={user} navigate={navigate} />}
            {activeTab === 'roles' && <RolesTab />}
            {activeTab === 'bans' && <BansTab clanId={clanId} />}
            {activeTab === 'audit' && <AuditLogTab clanId={clanId} />}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClanAdmin;


const MembersTab = ({ clanId, userRole }) => {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [selectedMembers, setSelectedMembers] = useState(new Set());
  const [bulkAction, setBulkAction] = useState(null);
  const [bulkLoading, setBulkLoading] = useState(false);

  useEffect(() => {
    fetchMembers();
  }, [clanId]);

  const fetchMembers = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/clans/${clanId}/members?limit=100`);
      if (response.success) {
        setMembers(response.data.members);
      }
    } catch (error) {
      console.error('Error fetching members:', error);
      toast.error('Failed to load members');
    } finally {
      setLoading(false);
    }
  };

  const handlePromote = async (memberId, newRole) => {
    try {
      setActionLoading(`promote-${memberId}`);
      await api.put(`/api/clans/${clanId}/members/${memberId}/role`, { role: newRole });
      toast.success(`Member promoted to ${newRole}`);
      fetchMembers();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to promote member');
    } finally {
      setActionLoading(null);
    }
  };

  const handleMute = async (memberId) => {
    try {
      setActionLoading(`mute-${memberId}`);
      await api.put(`/api/clans/${clanId}/members/${memberId}/mute`, { duration: 60 });
      toast.success('Member muted for 1 hour');
      fetchMembers();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to mute member');
    } finally {
      setActionLoading(null);
    }
  };

  const handleBan = async (userId) => {
    if (!window.confirm('Ban this member?')) return;
    try {
      setActionLoading(`ban-${userId}`);
      await api.post(`/api/clans/${clanId}/bans`, { userId, reason: 'Admin action' });
      toast.success('Member banned');
      fetchMembers();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to ban member');
    } finally {
      setActionLoading(null);
    }
  };

  const handleBulkAction = async () => {
    if (selectedMembers.size === 0) {
      toast.error('No members selected');
      return;
    }

    if (!bulkAction) {
      toast.error('Please select an action');
      return;
    }

    if (!window.confirm(`Apply "${bulkAction}" to ${selectedMembers.size} member(s)?`)) return;

    try {
      setBulkLoading(true);
      const memberIds = Array.from(selectedMembers);

      for (const memberId of memberIds) {
        const member = members.find(m => m._id === memberId);
        if (!member) continue;

        if (bulkAction === 'mute') {
          await api.put(`/api/clans/${clanId}/members/${memberId}/mute`, { duration: 60 });
        } else if (bulkAction === 'ban') {
          await api.post(`/api/clans/${clanId}/bans`, { userId: member.user._id, reason: 'Bulk admin action' });
        } else if (bulkAction === 'remove') {
          await api.delete(`/api/clans/${clanId}/members/${memberId}`);
        }
      }

      toast.success(`Applied "${bulkAction}" to ${selectedMembers.size} member(s)`);
      setSelectedMembers(new Set());
      setBulkAction(null);
      fetchMembers();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to apply bulk action');
    } finally {
      setBulkLoading(false);
    }
  };

  const toggleMemberSelection = (memberId) => {
    const newSelected = new Set(selectedMembers);
    if (newSelected.has(memberId)) {
      newSelected.delete(memberId);
    } else {
      newSelected.add(memberId);
    }
    setSelectedMembers(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedMembers.size === filteredMembers.length) {
      setSelectedMembers(new Set());
    } else {
      setSelectedMembers(new Set(filteredMembers.map(m => m._id)));
    }
  };

  // Filter members
  const filteredMembers = members.filter(member => {
    const matchesSearch = member.user?.username?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'all' || member.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  if (loading) return <div className="text-center text-gray-400 py-8">Loading...</div>;

  return (
    <div className="space-y-4">
      {/* Search and Filter */}
      <div className="bg-gaming-charcoal border border-gaming-border rounded-lg p-4 space-y-4">
        <div className="flex gap-4 flex-col sm:flex-row">
          <div className="flex-1 relative">
            <FiSearch className="absolute left-3 top-3 text-gray-500" />
            <input
              type="text"
              placeholder="Search members..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gaming-dark border border-gaming-border rounded text-white placeholder-gray-500"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-4 py-2 bg-gaming-dark border border-gaming-border rounded text-white"
          >
            <option value="all">All Roles</option>
            <option value="owner">Owner</option>
            <option value="admin">Admin</option>
            <option value="mod">Moderator</option>
            <option value="member">Member</option>
          </select>
        </div>

        {/* Bulk Actions */}
        {selectedMembers.size > 0 && (
          <div className="flex gap-2 items-center flex-wrap">
            <span className="text-sm text-gray-400">{selectedMembers.size} selected</span>
            <select
              value={bulkAction || ''}
              onChange={(e) => setBulkAction(e.target.value || null)}
              className="px-3 py-1 bg-gaming-dark border border-gaming-border rounded text-white text-sm"
            >
              <option value="">Select action...</option>
              <option value="mute">Mute All</option>
              <option value="remove">Remove All</option>
              <option value="ban">Ban All</option>
            </select>
            <button
              onClick={handleBulkAction}
              disabled={bulkLoading || !bulkAction}
              className="px-4 py-1 bg-gaming-gold text-black font-bold text-sm rounded hover:bg-yellow-500 disabled:opacity-50"
            >
              {bulkLoading ? 'Processing...' : 'Apply'}
            </button>
            <button
              onClick={() => setSelectedMembers(new Set())}
              className="px-3 py-1 bg-gray-500/20 text-gray-400 text-sm rounded hover:bg-gray-500/30"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Members Table */}
      <div className="bg-gaming-charcoal border border-gaming-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gaming-dark border-b border-gaming-border">
              <tr>
                <th className="px-4 py-4 text-left">
                  <input
                    type="checkbox"
                    checked={selectedMembers.size === filteredMembers.length && filteredMembers.length > 0}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded"
                  />
                </th>
                <th className="px-6 py-4 text-left text-sm font-bold text-gray-400">Member</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-gray-400">Role</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-gray-400">Joined</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-gray-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredMembers.map(member => (
                <tr key={member._id} className="border-b border-gaming-border hover:bg-gaming-dark/50">
                  <td className="px-4 py-4">
                    <input
                      type="checkbox"
                      checked={selectedMembers.has(member._id)}
                      onChange={() => toggleMemberSelection(member._id)}
                      className="w-4 h-4 rounded"
                    />
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gaming-border rounded-full flex items-center justify-center text-xs font-bold">
                        {member.user?.username?.[0]?.toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">{member.user?.username}</p>
                        <p className="text-xs text-gray-500">Lvl {member.user?.level || 1}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-3 py-1 bg-gaming-gold/20 text-gaming-gold text-xs font-bold rounded capitalize">
                      {member.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-400">
                    {new Date(member.joinedAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      {userRole === 'owner' && member.role !== 'owner' && (
                        <button
                          onClick={() => handlePromote(member._id, 'admin')}
                          disabled={actionLoading === `promote-${member._id}`}
                          className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs font-bold rounded hover:bg-blue-500/30 disabled:opacity-50"
                        >
                          Promote
                        </button>
                      )}
                      <button
                        onClick={() => handleMute(member._id)}
                        disabled={actionLoading === `mute-${member._id}`}
                        className="px-2 py-1 bg-yellow-500/20 text-yellow-400 text-xs font-bold rounded hover:bg-yellow-500/30 disabled:opacity-50"
                      >
                        Mute
                      </button>
                      <button
                        onClick={() => handleBan(member.user._id)}
                        disabled={actionLoading === `ban-${member.user._id}`}
                        className="px-2 py-1 bg-red-500/20 text-red-400 text-xs font-bold rounded hover:bg-red-500/30 disabled:opacity-50"
                      >
                        Ban
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {filteredMembers.length === 0 && (
        <div className="text-center text-gray-400 py-8">
          No members found matching your filters
        </div>
      )}
    </div>
  );
};


const ReportsTab = ({ clanId }) => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [selectedReport, setSelectedReport] = useState(null);

  useEffect(() => {
    fetchReports();
  }, [clanId]);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/clans/${clanId}/reports`);
      if (response.success) {
        setReports(response.data.reports || []);
      }
    } catch (error) {
      console.error('Error fetching reports:', error);
      toast.error('Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  const handleReportAction = async (reportId, action) => {
    try {
      setActionLoading(`${action}-${reportId}`);
      await api.put(`/api/clans/${clanId}/reports/${reportId}`, { action });
      toast.success(`Report ${action}ed`);
      setReports(reports.filter(r => r._id !== reportId));
      setSelectedReport(null);
    } catch (error) {
      toast.error(error.response?.data?.message || `Failed to ${action} report`);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) return <div className="text-center text-gray-400 py-8">Loading...</div>;

  if (reports.length === 0) {
    return (
      <div className="bg-gaming-charcoal border border-gaming-border rounded-lg p-8 text-center">
        <p className="text-gray-400">No pending reports</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {reports.map(report => (
          <div key={report._id} className="bg-gaming-charcoal border border-gaming-border rounded-lg p-6 cursor-pointer hover:border-gaming-gold/50 transition-colors" onClick={() => setSelectedReport(report)}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-sm text-gray-400">Reported by <span className="text-white font-semibold">{report.reportedBy?.username}</span></p>
                <p className="text-xs text-gray-500 mt-1">{new Date(report.createdAt).toLocaleString()}</p>
              </div>
              <span className="px-3 py-1 bg-red-500/20 text-red-400 text-xs font-bold rounded capitalize">
                {report.reason}
              </span>
            </div>
            <div className="bg-gaming-dark/50 border-l-4 border-red-500 p-4 mb-4 rounded">
              <p className="text-sm text-gray-300 line-clamp-2">{report.message?.content}</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={(e) => { e.stopPropagation(); handleReportAction(report._id, 'dismiss'); }}
                disabled={actionLoading === `dismiss-${report._id}`}
                className="px-4 py-2 bg-gray-500/20 text-gray-400 text-sm font-bold rounded hover:bg-gray-500/30 disabled:opacity-50"
              >
                Dismiss
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleReportAction(report._id, 'warn'); }}
                disabled={actionLoading === `warn-${report._id}`}
                className="px-4 py-2 bg-yellow-500/20 text-yellow-400 text-sm font-bold rounded hover:bg-yellow-500/30 disabled:opacity-50"
              >
                Warn
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleReportAction(report._id, 'delete'); }}
                disabled={actionLoading === `delete-${report._id}`}
                className="px-4 py-2 bg-orange-500/20 text-orange-400 text-sm font-bold rounded hover:bg-orange-500/30 disabled:opacity-50"
              >
                Delete
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleReportAction(report._id, 'ban'); }}
                disabled={actionLoading === `ban-${report._id}`}
                className="px-4 py-2 bg-red-500/20 text-red-400 text-sm font-bold rounded hover:bg-red-500/30 disabled:opacity-50"
              >
                Ban User
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Report Details Modal */}
      {selectedReport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gaming-charcoal border border-gaming-border rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gaming-dark border-b border-gaming-border p-6 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Report Details</h2>
              <button
                onClick={() => setSelectedReport(null)}
                className="text-gray-400 hover:text-white"
              >
                <FiX className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Report Info */}
              <div className="space-y-3">
                <h3 className="text-lg font-bold text-white">Report Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Reported By</p>
                    <p className="text-white font-semibold">{selectedReport.reportedBy?.username}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Reason</p>
                    <span className="inline-block px-3 py-1 bg-red-500/20 text-red-400 text-xs font-bold rounded capitalize">
                      {selectedReport.reason}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Reported At</p>
                    <p className="text-white">{new Date(selectedReport.createdAt).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Status</p>
                    <span className="inline-block px-3 py-1 bg-blue-500/20 text-blue-400 text-xs font-bold rounded capitalize">
                      {selectedReport.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Description */}
              {selectedReport.description && (
                <div className="space-y-2">
                  <h3 className="text-lg font-bold text-white">Description</h3>
                  <p className="text-gray-300 bg-gaming-dark/50 p-4 rounded border border-gaming-border">
                    {selectedReport.description}
                  </p>
                </div>
              )}

              {/* Reported Message */}
              <div className="space-y-2">
                <h3 className="text-lg font-bold text-white">Reported Message</h3>
                <div className="bg-gaming-dark/50 border-l-4 border-red-500 p-4 rounded">
                  <p className="text-xs text-gray-500 mb-2">From: <span className="text-white">{selectedReport.message?.sender?.username}</span></p>
                  <p className="text-gray-300">{selectedReport.message?.content}</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 flex-wrap pt-4 border-t border-gaming-border">
                <button
                  onClick={() => { handleReportAction(selectedReport._id, 'dismiss'); }}
                  disabled={actionLoading === `dismiss-${selectedReport._id}`}
                  className="px-4 py-2 bg-gray-500/20 text-gray-400 font-bold rounded hover:bg-gray-500/30 disabled:opacity-50"
                >
                  Dismiss
                </button>
                <button
                  onClick={() => { handleReportAction(selectedReport._id, 'warn'); }}
                  disabled={actionLoading === `warn-${selectedReport._id}`}
                  className="px-4 py-2 bg-yellow-500/20 text-yellow-400 font-bold rounded hover:bg-yellow-500/30 disabled:opacity-50"
                >
                  Warn
                </button>
                <button
                  onClick={() => { handleReportAction(selectedReport._id, 'delete'); }}
                  disabled={actionLoading === `delete-${selectedReport._id}`}
                  className="px-4 py-2 bg-orange-500/20 text-orange-400 font-bold rounded hover:bg-orange-500/30 disabled:opacity-50"
                >
                  Delete Message
                </button>
                <button
                  onClick={() => { handleReportAction(selectedReport._id, 'ban'); }}
                  disabled={actionLoading === `ban-${selectedReport._id}`}
                  className="px-4 py-2 bg-red-500/20 text-red-400 font-bold rounded hover:bg-red-500/30 disabled:opacity-50"
                >
                  Ban User
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};


const SettingsTab = ({ clanId, clan, setClan, user, navigate }) => {
  const [formData, setFormData] = useState({
    maxMembers: 100,
    visibility: 'public',
    isLocked: false
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (clan) {
      setFormData({
        maxMembers: clan.maxMembers || 100,
        visibility: clan.visibility || 'public',
        isLocked: clan.isLocked || false
      });
    }
  }, [clan]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const response = await api.patch(`/api/clans/${clanId}`, {
        maxMembers: parseInt(formData.maxMembers),
        visibility: formData.visibility,
        isLocked: formData.isLocked
      });
      if (response.success) {
        setClan(response.data.clan);
        toast.success('Settings saved');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-gaming-charcoal border border-gaming-border rounded-lg p-6 space-y-6">
      <div className="border-b border-gaming-border pb-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-white">Lock Clan</h3>
            <p className="text-sm text-gray-400">Prevent new members from joining</p>
          </div>
          <input
            type="checkbox"
            name="isLocked"
            checked={formData.isLocked}
            onChange={handleChange}
            className="w-5 h-5 rounded"
          />
        </div>
      </div>

      <div className="border-b border-gaming-border pb-6">
        <label className="text-lg font-bold text-white block mb-2">Max Members</label>
        <input
          type="number"
          name="maxMembers"
          value={formData.maxMembers}
          onChange={handleChange}
          min="2"
          max="1000"
          className="w-full px-4 py-2 bg-gaming-dark border border-gaming-border rounded text-white"
        />
      </div>

      <div className="pb-6">
        <label className="text-lg font-bold text-white block mb-2">Visibility</label>
        <select
          name="visibility"
          value={formData.visibility}
          onChange={handleChange}
          className="w-full px-4 py-2 bg-gaming-dark border border-gaming-border rounded text-white"
        >
          <option value="public">Public</option>
          <option value="private">Private</option>
          <option value="invite">Invite Only</option>
        </select>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full px-6 py-3 bg-gaming-gold hover:bg-yellow-500 disabled:opacity-50 text-black font-bold rounded-lg transition-colors"
      >
        {saving ? 'Saving...' : 'Save Settings'}
      </button>

      {/* Danger Zone */}
      {clan?.owner?._id === (user?._id || user?.id) && (
        <div className="mt-12 pt-8 border-t border-red-500/20">
          <h3 className="text-red-500 font-gaming font-bold text-xl mb-4">Danger Zone</h3>
          <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <p className="text-white font-bold">Delete Clan</p>
                <p className="text-sm text-gray-400">Once you delete a clan, there is no going back. All data will be lost.</p>
              </div>
              <button
                onClick={async () => {
                  if (window.confirm('CRITICAL: Are you absolutely sure? This will delete all members, messages, and clan data permanently.')) {
                    try {
                      const res = await api.delete(`/api/clans/${clanId}`);
                      if (res.success) {
                        toast.success('Clan deleted successfully');
                        navigate('/clans');
                      }
                    } catch (err) {
                      toast.error(err.response?.data?.message || 'Failed to delete clan');
                    }
                  }
                }}
                className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors"
              >
                Delete Clan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


const RolesTab = () => {
  const [roles, setRoles] = useState([
    {
      name: 'Owner',
      color: 'gold',
      permissions: ['Manage all settings', 'Promote/demote members', 'Ban members', 'Delete clan', 'Create custom roles']
    },
    {
      name: 'Admin',
      color: 'blue',
      permissions: ['Manage settings', 'Promote/demote members', 'Ban members', 'Delete messages', 'Handle reports']
    },
    {
      name: 'Moderator',
      color: 'purple',
      permissions: ['Mute members', 'Delete messages', 'View reports', 'Pin messages']
    },
    {
      name: 'Member',
      color: 'gray',
      permissions: ['Send messages', 'View clan info', 'Report messages', 'React to messages']
    }
  ]);
  const [showCustomRoleForm, setShowCustomRoleForm] = useState(false);
  const [customRoleName, setCustomRoleName] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState(new Set());

  const availablePermissions = [
    'Send messages',
    'Edit own messages',
    'Delete own messages',
    'Pin messages',
    'React to messages',
    'Mute members',
    'Delete messages',
    'View reports',
    'Handle reports',
    'Promote/demote members',
    'Ban members',
    'Manage settings',
    'Delete clan',
    'Create custom roles'
  ];

  const handleAddCustomRole = () => {
    if (!customRoleName.trim()) {
      toast.error('Role name is required');
      return;
    }

    if (selectedPermissions.size === 0) {
      toast.error('Select at least one permission');
      return;
    }

    const newRole = {
      name: customRoleName,
      color: 'indigo',
      permissions: Array.from(selectedPermissions),
      isCustom: true
    };

    setRoles([...roles, newRole]);
    setCustomRoleName('');
    setSelectedPermissions(new Set());
    setShowCustomRoleForm(false);
    toast.success(`Custom role "${customRoleName}" created`);
  };

  const togglePermission = (permission) => {
    const newSelected = new Set(selectedPermissions);
    if (newSelected.has(permission)) {
      newSelected.delete(permission);
    } else {
      newSelected.add(permission);
    }
    setSelectedPermissions(newSelected);
  };

  const deleteCustomRole = (roleName) => {
    if (!window.confirm(`Delete role "${roleName}"?`)) return;
    setRoles(roles.filter(r => r.name !== roleName));
    toast.success(`Role "${roleName}" deleted`);
  };

  return (
    <div className="space-y-6">
      {/* Built-in Roles */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-white">Built-in Roles</h3>
        {roles.filter(r => !r.isCustom).map((role, idx) => (
          <div key={idx} className="bg-gaming-charcoal border border-gaming-border rounded-lg p-6">
            <h4 className={`text-lg font-bold mb-4 ${role.color === 'gold' ? 'text-gaming-gold' : role.color === 'blue' ? 'text-blue-400' : role.color === 'purple' ? 'text-purple-400' : 'text-gray-400'}`}>
              {role.name}
            </h4>
            <ul className="space-y-2">
              {role.permissions.map((perm, pidx) => (
                <li key={pidx} className="flex items-center gap-2 text-gray-300">
                  <span className={`w-2 h-2 rounded-full ${role.color === 'gold' ? 'bg-gaming-gold' : role.color === 'blue' ? 'bg-blue-400' : role.color === 'purple' ? 'bg-purple-400' : 'bg-gray-400'}`} />
                  {perm}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Custom Roles */}
      {roles.filter(r => r.isCustom).length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-white">Custom Roles</h3>
          {roles.filter(r => r.isCustom).map((role, idx) => (
            <div key={idx} className="bg-gaming-charcoal border border-gaming-border rounded-lg p-6">
              <div className="flex items-start justify-between mb-4">
                <h4 className="text-lg font-bold text-indigo-400">{role.name}</h4>
                <button
                  onClick={() => deleteCustomRole(role.name)}
                  className="px-3 py-1 bg-red-500/20 text-red-400 text-xs font-bold rounded hover:bg-red-500/30"
                >
                  Delete
                </button>
              </div>
              <ul className="space-y-2">
                {role.permissions.map((perm, pidx) => (
                  <li key={pidx} className="flex items-center gap-2 text-gray-300">
                    <span className="w-2 h-2 bg-indigo-400 rounded-full" />
                    {perm}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {/* Create Custom Role */}
      <div className="bg-gaming-charcoal border border-gaming-border rounded-lg p-6">
        <button
          onClick={() => setShowCustomRoleForm(!showCustomRoleForm)}
          className="w-full px-4 py-2 bg-gaming-gold text-black font-bold rounded hover:bg-yellow-500 transition-colors flex items-center justify-between"
        >
          <span>Create Custom Role</span>
          <FiChevronDown className={`transition-transform ${showCustomRoleForm ? 'rotate-180' : ''}`} />
        </button>

        {showCustomRoleForm && (
          <div className="mt-6 space-y-4 pt-6 border-t border-gaming-border">
            <div>
              <label className="text-white font-bold block mb-2">Role Name</label>
              <input
                type="text"
                value={customRoleName}
                onChange={(e) => setCustomRoleName(e.target.value)}
                placeholder="e.g., Veteran, Trusted, etc."
                className="w-full px-4 py-2 bg-gaming-dark border border-gaming-border rounded text-white placeholder-gray-500"
              />
            </div>

            <div>
              <label className="text-white font-bold block mb-3">Permissions</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {availablePermissions.map((perm, idx) => (
                  <label key={idx} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedPermissions.has(perm)}
                      onChange={() => togglePermission(perm)}
                      className="w-4 h-4 rounded"
                    />
                    <span className="text-gray-300 text-sm">{perm}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <button
                onClick={handleAddCustomRole}
                className="flex-1 px-4 py-2 bg-gaming-gold text-black font-bold rounded hover:bg-yellow-500"
              >
                Create Role
              </button>
              <button
                onClick={() => {
                  setShowCustomRoleForm(false);
                  setCustomRoleName('');
                  setSelectedPermissions(new Set());
                }}
                className="flex-1 px-4 py-2 bg-gray-500/20 text-gray-400 font-bold rounded hover:bg-gray-500/30"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const BansTab = ({ clanId }) => {
  const [bans, setBans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);

  useEffect(() => {
    fetchBans();
  }, [clanId]);

  const fetchBans = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/clans/${clanId}/bans`);
      if (response.success) {
        setBans(response.data.bannedUsers || []);
      }
    } catch (error) {
      console.error('Error fetching bans:', error);
      toast.error('Failed to load bans');
    } finally {
      setLoading(false);
    }
  };

  const handleUnban = async (userId) => {
    if (!window.confirm('Unban this user?')) return;
    try {
      setActionLoading(`unban-${userId}`);
      await api.delete(`/api/clans/${clanId}/bans/${userId}`);
      toast.success('User unbanned');
      fetchBans();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to unban');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) return <div className="text-center text-gray-400 py-8">Loading...</div>;

  if (bans.length === 0) {
    return (
      <div className="bg-gaming-charcoal border border-gaming-border rounded-lg p-8 text-center">
        <p className="text-gray-400">No banned users</p>
      </div>
    );
  }

  return (
    <div className="bg-gaming-charcoal border border-gaming-border rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gaming-dark border-b border-gaming-border">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-bold text-gray-400">User</th>
              <th className="px-6 py-4 text-left text-sm font-bold text-gray-400">Reason</th>
              <th className="px-6 py-4 text-left text-sm font-bold text-gray-400">Banned At</th>
              <th className="px-6 py-4 text-left text-sm font-bold text-gray-400">Action</th>
            </tr>
          </thead>
          <tbody>
            {bans.map(ban => (
              <tr key={ban._id} className="border-b border-gaming-border hover:bg-gaming-dark/50">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gaming-border rounded-full flex items-center justify-center text-xs font-bold">
                      {ban?.username?.[0]?.toUpperCase()}
                    </div>
                    <p className="text-sm font-semibold text-white">{ban?.username}</p>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-400">Banned Information</td>
                <td className="px-6 py-4 text-sm text-gray-400">
                  {ban?.createdAt ? new Date(ban.createdAt).toLocaleDateString() : 'N/A'}
                </td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => handleUnban(ban._id)}
                    disabled={actionLoading === `unban-${ban._id}`}
                    className="px-4 py-2 bg-green-500/20 text-green-400 text-sm font-bold rounded hover:bg-green-500/30 disabled:opacity-50"
                  >
                    Unban
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const AuditLogTab = ({ clanId }) => {
  const [auditLogs, setAuditLogs] = useState([
    {
      id: 1,
      action: 'Member Promoted',
      actor: 'Admin',
      target: 'Player123',
      details: 'Promoted to Admin',
      timestamp: new Date(Date.now() - 3600000),
      type: 'promotion'
    },
    {
      id: 2,
      action: 'Member Muted',
      actor: 'Moderator',
      target: 'Spammer',
      details: 'Muted for 1 hour',
      timestamp: new Date(Date.now() - 7200000),
      type: 'mute'
    },
    {
      id: 3,
      action: 'Member Banned',
      actor: 'Owner',
      target: 'Hacker',
      details: 'Banned for cheating',
      timestamp: new Date(Date.now() - 86400000),
      type: 'ban'
    },
    {
      id: 4,
      action: 'Settings Updated',
      actor: 'Owner',
      target: 'Clan Settings',
      details: 'Max members changed from 50 to 100',
      timestamp: new Date(Date.now() - 172800000),
      type: 'settings'
    },
    {
      id: 5,
      action: 'Report Handled',
      actor: 'Admin',
      target: 'Report #123',
      details: 'User warned for harassment',
      timestamp: new Date(Date.now() - 259200000),
      type: 'report'
    }
  ]);
  const [filterType, setFilterType] = useState('all');

  const getActionColor = (type) => {
    switch (type) {
      case 'promotion': return 'bg-blue-500/20 text-blue-400';
      case 'mute': return 'bg-yellow-500/20 text-yellow-400';
      case 'ban': return 'bg-red-500/20 text-red-400';
      case 'settings': return 'bg-purple-500/20 text-purple-400';
      case 'report': return 'bg-orange-500/20 text-orange-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  const filteredLogs = filterType === 'all' ? auditLogs : auditLogs.filter(log => log.type === filterType);

  return (
    <div className="space-y-4">
      {/* Filter */}
      <div className="bg-gaming-charcoal border border-gaming-border rounded-lg p-4">
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-4 py-2 bg-gaming-dark border border-gaming-border rounded text-white"
        >
          <option value="all">All Actions</option>
          <option value="promotion">Promotions</option>
          <option value="mute">Mutes</option>
          <option value="ban">Bans</option>
          <option value="settings">Settings</option>
          <option value="report">Reports</option>
        </select>
      </div>

      {/* Audit Log Timeline */}
      <div className="space-y-3">
        {filteredLogs.map((log, idx) => (
          <div key={log.id} className="bg-gaming-charcoal border border-gaming-border rounded-lg p-4">
            <div className="flex items-start gap-4">
              {/* Timeline dot */}
              <div className="flex flex-col items-center">
                <div className={`w-3 h-3 rounded-full ${getActionColor(log.type).split(' ')[0]}`} />
                {idx < filteredLogs.length - 1 && <div className="w-0.5 h-12 bg-gaming-border mt-2" />}
              </div>

              {/* Log content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-3 py-1 text-xs font-bold rounded ${getActionColor(log.type)}`}>
                        {log.action}
                      </span>
                      <p className="text-sm text-gray-400">
                        by <span className="text-white font-semibold">{log.actor}</span>
                      </p>
                    </div>
                    <p className="text-sm text-gray-300 mt-2">
                      <span className="font-semibold">{log.target}</span> - {log.details}
                    </p>
                  </div>
                  <p className="text-xs text-gray-500 whitespace-nowrap">
                    {log.timestamp.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredLogs.length === 0 && (
        <div className="text-center text-gray-400 py-8">
          No audit logs found
        </div>
      )}
    </div>
  );
};
