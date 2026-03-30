import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useClan } from '../../contexts/ClanContext';
import ClanDropdown from './ClanDropdown';
import { FiPlus, FiChevronDown } from 'react-icons/fi';

// Color palette for avatar backgrounds (6 colors)
const AVATAR_COLORS = [
  'bg-red-500',
  'bg-blue-500',
  'bg-green-500',
  'bg-purple-500',
  'bg-yellow-500',
  'bg-pink-500'
];

const ClanNavPill = () => {
  const navigate = useNavigate();
  const { myClan, unreadCount } = useClan();
  const [isOpen, setIsOpen] = useState(false);
  const pillRef = useRef(null);
  const dropdownRef = useRef(null);

  // Debug log whenever myClan changes
  useEffect(() => {
    console.log('🎮 ClanNavPill: myClan changed:', myClan);
  }, [myClan]);

  // Get avatar color based on clan tag
  const getAvatarColor = () => {
    if (!myClan?.clan?.tag) return AVATAR_COLORS[0];
    const colorIndex = myClan.clan.tag.charCodeAt(0) % AVATAR_COLORS.length;
    return AVATAR_COLORS[colorIndex];
  };

  // Get avatar initials
  const getAvatarInitials = () => {
    if (!myClan?.clan?.name) return '??';
    return myClan.clan.name.substring(0, 2).toUpperCase();
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        pillRef.current &&
        !pillRef.current.contains(event.target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Variant A: No clan
  if (!myClan) {
    return (
      <button
        onClick={() => navigate('/clans')}
        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-400 border border-slate-600 rounded-lg hover:text-slate-300 hover:border-slate-500 transition-colors"
        title="Join a clan"
      >
        <FiPlus className="w-4 h-4" />
        <span>Join a clan</span>
      </button>
    );
  }

  // Variant B: Has clan
  return (
    <div className="relative" ref={pillRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 border border-slate-600 rounded-full hover:bg-slate-600 transition-colors"
        title={myClan.clan.name}
      >
        {/* Avatar with initials */}
        <div
          className={`w-6 h-6 rounded-full ${getAvatarColor()} flex items-center justify-center text-xs font-bold text-white`}
        >
          {getAvatarInitials()}
        </div>

        {/* Clan name */}
        <span className="text-sm font-medium text-white truncate max-w-[100px]">
          {myClan.clan.name}
        </span>

        {/* Online indicator (placeholder - would need real online status) */}
        <div className="w-2 h-2 rounded-full bg-green-500" />

        {/* Unread badge */}
        {unreadCount > 0 && (
          <span className="px-2 py-0.5 text-xs font-bold text-white bg-purple-600 rounded-full">
            {unreadCount}
          </span>
        )}

        {/* Chevron */}
        <FiChevronDown
          className={`w-4 h-4 text-slate-400 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div ref={dropdownRef} className="relative z-50">
          <ClanDropdown onClose={() => setIsOpen(false)} />
        </div>
      )}
    </div>
  );
};

export default ClanNavPill;
