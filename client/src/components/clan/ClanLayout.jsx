import React from 'react';
import { NavLink, useParams, useLocation } from 'react-router-dom';
import { useClan } from '../../contexts/ClanContext';
import { useAuth } from '../../hooks/useAuth';
import { usePresence } from '../../hooks/usePresence';
import { FiMessageSquare, FiActivity, FiSettings, FiUsers, FiHexagon } from 'react-icons/fi';
import styles from './ClanHub.module.css';

const getAvatarColor = (char) => {
  const colors = [
    '#6c5ce7', '#a29bfe', '#00b894', '#00cec9',
    '#0984e3', '#e17055', '#d63031', '#e84393',
    '#f1c40f', '#2ecc71', '#3498db', '#9b59b6'
  ];
  if (!char) return colors[0];
  const charCode = char.charCodeAt(0);
  return colors[charCode % colors.length];
};

const MemberSidebarRow = ({ member, isOnline }) => {
  const avatarColor = getAvatarColor(member.user?.username?.[0]);
  const initials = member.user?.username?.substring(0, 2).toUpperCase() || '??';

  const getRoleBadge = () => {
    if (member.role === 'owner') return { bg: 'rgba(241, 196, 15, 0.15)', color: '#f1c40f', border: '1px solid rgba(241, 196, 15, 0.3)', text: 'OWNER' };
    if (member.role === 'mod') return { bg: 'rgba(0, 212, 255, 0.15)', color: '#00d4ff', border: '1px solid rgba(0, 212, 255, 0.3)', text: 'MOD' };
    return null;
  };

  const badge = getRoleBadge();

  return (
    <div className={styles.memberRow} style={{ opacity: isOnline ? 1 : 0.5 }}>
      <div className={styles.memberAvatar} style={{ background: avatarColor }}>
        {initials}
        {isOnline && <div className={styles.statusDot} />}
      </div>
      <span className={styles.memberUsername}>{member.user?.username}</span>
      {badge && (
        <span className={styles.memberRoleBadge} style={{ background: badge.bg, color: badge.color, border: badge.border }}>
          {badge.text}
        </span>
      )}
    </div>
  );
};

const ClanLayout = ({ children }) => {
  const { id: clanId } = useParams();
  const { user } = useAuth();
  const { myClan, members, isLoadingMembers } = useClan();
  const presence = usePresence(clanId);

  const userId = user?._id || user?.id;
  const onlineMembers = members.filter(m => presence?.[m.user?._id] === 'online' || m.user?._id === userId);
  const offlineMembers = members.filter(m => presence?.[m.user?._id] !== 'online' && m.user?._id !== userId);

  const navItems = [
    { id: 'chat', label: 'General Chat', icon: FiMessageSquare, path: `/clans/${clanId}/chat` },
    { id: 'profile', label: 'Clan Overview', icon: FiHexagon, path: `/clans/${clanId}` },
    { id: 'announcements', label: 'Announcements', icon: FiActivity, path: `/clans/${clanId}/announcements` },
  ];

  // Add Admin if user has permissions
  const isAdmin = myClan?.role === 'owner' || myClan?.role === 'admin' || myClan?.role === 'mod';
  if (isAdmin) {
    navItems.push({ id: 'admin', label: 'Management', icon: FiSettings, path: `/clans/${clanId}/admin` });
  }

  return (
    <div className={styles.hubContainer}>
      {/* Left Rail - Clan Icons */}
      {/* <div className={styles.leftRail}>
        <NavLink to={`/clans/${clanId}`} className={({ isActive }) => 
          `${styles.clanIcon} ${isActive ? styles.clanIconActive : ''}`
        }>
          {myClan?.clan?.name?.[0].toUpperCase() || 'C'}
        </NavLink>
        <NavLink to="/clans" className={styles.clanIcon} title="Browse Clans">
          +
        </NavLink>
      </div> */}

      {/* Navigation Sidebar */}
      <div className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          {myClan?.clan?.name || 'Clan Hub'}
        </div>
        <nav className={styles.navSection}>
          <div className={styles.sectionLabel}>CHANNELS</div>
          {navItems.map((item) => (
            <NavLink
              key={item.id}
              to={item.path}
              className={({ isActive }) =>
                `${styles.navItem} ${isActive ? styles.navItemActive : ''}`
              }
            >
              <item.icon size={18} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Main Content Area */}
      <main className={styles.mainContent}>
        {children}
      </main>

      {/* Right Sidebar - Members */}
      <div className={styles.rightSidebar}>
        <div className={styles.rightSidebarHeader}>
          Members — {members.length}
        </div>
        <div className={styles.memberList}>
          {onlineMembers.length > 0 && (
            <>
              <div className={styles.sectionLabel}>ONLINE — {onlineMembers.length}</div>
              {onlineMembers.map(m => <MemberSidebarRow key={m._id} member={m} isOnline={true} />)}
            </>
          )}

          {offlineMembers.length > 0 && (
            <>
              <div className={styles.sectionLabel} style={{ marginTop: '20px' }}>OFFLINE — {offlineMembers.length}</div>
              {offlineMembers.map(m => <MemberSidebarRow key={m._id} member={m} isOnline={false} />)}
            </>
          )}

          {isLoadingMembers && members.length === 0 && (
            <div className={styles.loadingMembers}>Loading...</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClanLayout;
