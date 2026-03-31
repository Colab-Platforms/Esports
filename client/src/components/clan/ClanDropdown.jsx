import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useClan } from '../../contexts/ClanContext';
import api from '../../services/api';
import toast from 'react-hot-toast';
import {
  FiMessageSquare,
  FiUsers,
  FiUserPlus,
  FiSettings,
  FiLogOut,
  FiAlertCircle,
  FiCopy,
  FiCheck
} from 'react-icons/fi';

const ClanDropdown = ({ onClose }) => {
  const navigate = useNavigate();
  const { myClan, unreadCount, clearUnread, refreshMyClan } = useClan();
  const [clanDetail, setClanDetail] = useState(null);
  const [members, setMembers] = useState([]);
  const [onlineUserIds, setOnlineUserIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);

  // Fetch clan detail and members on mount
  useEffect(() => {
    const fetchData = async () => {
      if (!myClan?.clan?._id) return;

      try {
        setLoading(true);
        const [clanRes, membersRes, presenceRes] = await Promise.all([
          api.get(`/api/clans/${myClan.clan._id}`),
          api.get(`/api/clans/${myClan.clan._id}/members?limit=5`),
          api.get(`/api/clans/${myClan.clan._id}/presence`)
        ]);

        if (clanRes.success) {
          setClanDetail(clanRes.data.clan);
        }
        if (membersRes.success) {
          setMembers(membersRes.data.members || []);
        }
        if (presenceRes?.success && presenceRes.data?.onlineUserIds) {
          setOnlineUserIds(presenceRes.data.onlineUserIds.map(id => id.toString()));
        }
      } catch (error) {
        console.error('Error fetching clan data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [myClan?.clan?._id]);

  // Handle invite copy
  const handleCopyInvite = async () => {
    try {
      // Direct link to the clan profile which natively supports the join flow
      const inviteLink = `${window.location.origin}/clans/${myClan.clan._id}`;
      await navigator.clipboard.writeText(inviteLink);
      setCopiedInvite(true);
      toast.success('Invite link copied!');
      setTimeout(() => setCopiedInvite(false), 2000); // Leave dropdown open so they see the checkmark
    } catch (error) {
      toast.error('Failed to copy invite link');
    }
  };

  // Handle leave clan
  const handleLeaveClan = async () => {
    if (!myClan?.clan?._id) return;

    try {
      setIsLeaving(true);
      const response = await api.post(`/api/clans/${myClan.clan._id}/leave`);

      if (response.success) {
        toast.success('You have left the clan');
        // Refresh clan context - this will set myClan to null and navbar will update
        await refreshMyClan();
        onClose();
        navigate('/clans');
      }
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to leave clan';
      toast.error(message);
    } finally {
      setIsLeaving(false);
      setShowLeaveConfirm(false);
    }
  };

  if (!myClan) return null;

  const isAdmin = ['owner', 'admin', 'mod'].includes(myClan.role);
  const memberCount = myClan?.clan?.memberCount || clanDetail?.memberCount || 0;
  const onlineCount = onlineUserIds.length;

  return (
    <div className="absolute top-full right-0 mt-2 w-80 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50">
      {/* Header */}
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
            {myClan.clan.name.substring(0, 2).toUpperCase()}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-white truncate">
              {myClan.clan.name}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {loading ? '...' : `${onlineCount} online`} · {memberCount} members
            </p>
          </div>

          {/* Role badge */}
          <span className="px-2 py-1 text-xs font-semibold text-white bg-blue-600 rounded whitespace-nowrap">
            {myClan.role}
          </span>
        </div>
      </div>

      {/* Clan Members */}
      {!loading && members.length > 0 && (
        <div className="px-4 py-3 border-b border-slate-700">
          <p className="text-xs text-slate-400 mb-2">Members ({onlineCount} online)</p>
          <div className="flex items-center gap-2">
            {members.slice(0, 4).map((member, i) => {
              const isOnline = onlineUserIds.includes(member.user?._id?.toString());
              return (
                <div
                  key={member._id || i}
                  title={member.user?.username}
                  className={`w-8 h-8 rounded-full border border-slate-500 flex items-center justify-center text-xs font-bold text-white cursor-pointer hover:opacity-80 transition-colors ${isOnline ? 'bg-green-500' : 'bg-slate-600'}`}
                  onClick={() => {
                    navigate(`/clans/${myClan.clan._id}?tab=members`);
                    onClose();
                  }}
                >
                  {member.user?.username ? member.user.username.charAt(0).toUpperCase() : '?'}
                </div>
              )
            })}
            {memberCount > 4 && (
              <div
                className="w-8 h-8 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center text-xs font-bold text-slate-300 cursor-pointer hover:bg-slate-600 transition-colors"
                onClick={() => {
                  navigate(`/clans/${myClan.clan._id}?tab=members`);
                  onClose();
                }}
                title="View all members"
              >
                +{memberCount - 4}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Stats row */}
      {!loading && (
        <div className="px-4 py-3 border-b border-slate-700 grid grid-cols-3 gap-4">
          <div className="text-center py-1 flex items-center justify-center flex-col">
            <p className="text-xs text-slate-400 mb-1">Members</p>
            <p className="text-sm font-bold text-white flex justify-center">{memberCount}</p>
          </div>
          <button
            type="button"
            className="text-center cursor-pointer hover:bg-slate-700 rounded transition-colors py-1 flex items-center justify-center flex-col outline-none focus:bg-slate-700"
            onClick={() => {
              navigate(`/clans/${myClan.clan._id}`);
              onClose();
            }}
            title="Clan Activity"
          >
            <p className="text-xs text-slate-400 mb-1">Activity</p>
            <p className="text-sm font-bold text-slate-300 flex justify-center">
              <FiAlertCircle className="w-4 h-4" />
            </p>
          </button>
          <button
            type="button"
            className="text-center cursor-pointer hover:bg-slate-700 rounded transition-colors py-1 flex items-center justify-center flex-col outline-none focus:bg-slate-700"
            onClick={handleCopyInvite}
            title="Invite members"
          >
            <p className="text-xs text-slate-400 mb-1">Invite</p>
            <p className="text-sm font-bold text-slate-300 flex justify-center">
              {copiedInvite ? <FiCheck className="w-4 h-4 text-green-400" /> : <FiUserPlus className="w-4 h-4" />}
            </p>
          </button>
        </div>
      )}

      {/* Menu items */}
      <div className="py-2">
        {/* Open clan chat */}
        <button
          type="button"
          onClick={() => {
            clearUnread();
            navigate(`/clans/${myClan.clan._id}/chat`);
            onClose();
          }}
          className="w-full px-4 py-2 flex items-center gap-3 text-sm text-slate-300 hover:bg-slate-700 transition-colors text-left"
        >
          <FiMessageSquare className="w-4 h-4 flex-shrink-0" />
          <span>Open clan chat</span>
          {unreadCount > 0 && (
            <span className="ml-auto px-2 py-0.5 text-xs font-bold text-white bg-purple-600 rounded-full flex-shrink-0">
              {unreadCount}
            </span>
          )}
        </button>

        {/* Clan activity */}
        {/* <button
          type="button"
          onClick={() => {
            navigate(`/clans/${myClan.clan._id}`);
            onClose();
          }}
          className="w-full px-4 py-2 flex items-center gap-3 text-sm text-slate-300 hover:bg-slate-700 transition-colors text-left"
        >
          <FiAlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>Clan activity</span>
        </button> */}

        {/* Members */}
        {/* <button
          type="button"
          onClick={() => {
            navigate(`/clans/${myClan.clan._id}?tab=members`);
            onClose();
          }}
          className="w-full px-4 py-2 flex items-center gap-3 text-sm text-slate-300 hover:bg-slate-700 transition-colors text-left"
        >
          <FiUsers className="w-4 h-4 flex-shrink-0" />
          <span>Members</span>
        </button> */}

        {/* Invite members */}
        {/* <button
          type="button"
          onClick={handleCopyInvite}
          className="w-full px-4 py-2 flex items-center gap-3 text-sm text-slate-300 hover:bg-slate-700 transition-colors text-left"
        >
          <FiUserPlus className="w-4 h-4 flex-shrink-0" />
          <span>Invite members</span>
          {copiedInvite && <FiCheck className="ml-auto w-4 h-4 text-green-400 flex-shrink-0" />}
        </button> */}

        {/* Admin panel (only for admin/mod/owner) */}
        {isAdmin && (
          <button
            type="button"
            onClick={() => {
              navigate(`/clans/${myClan.clan._id}/admin?tab=settings`);
              onClose();
            }}
            className="w-full px-4 py-2 flex items-center gap-3 text-sm text-slate-300 hover:bg-slate-700 transition-colors text-left"
          >
            <FiSettings className="w-4 h-4 flex-shrink-0" />
            <span>Clan settings</span>
          </button>
        )}

        {/* Clan settings (only for admin/mod/owner) */}
        {/* {isAdmin && (
          <button
            type="button"
            onClick={() => {
              navigate(`/clans/${myClan.clan._id}/admin?tab=settings`);
              onClose();
            }}
            className="w-full px-4 py-2 flex items-center gap-3 text-sm text-slate-300 hover:bg-slate-700 transition-colors text-left"
          >
            <FiSettings className="w-4 h-4 flex-shrink-0" />
            <span>Clan settings</span>
          </button>
        )} */}
      </div>

      {/* Leave clan section */}
      <div className="px-4 py-3 border-t border-slate-700">
        {!showLeaveConfirm ? (
          <button
            onClick={() => setShowLeaveConfirm(true)}
            className="w-full px-3 py-2 flex items-center justify-center gap-2 text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
          >
            <FiLogOut className="w-4 h-4" />
            <span>Leave clan</span>
          </button>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-slate-300">
              Are you sure? You'll lose access to clan chat and features.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowLeaveConfirm(false)}
                className="flex-1 px-3 py-2 text-xs font-medium text-slate-300 bg-slate-700 hover:bg-slate-600 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleLeaveClan}
                disabled={isLeaving}
                className="flex-1 px-3 py-2 text-xs font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors"
              >
                {isLeaving ? 'Leaving...' : 'Leave'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClanDropdown;
