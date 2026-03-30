import React, { useEffect, useState, useRef, useCallback, useMemo, forwardRef, useLayoutEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useClan } from '../../contexts/ClanContext';
import { useAuth } from '../../hooks/useAuth';
import { useChat } from '../../hooks/useChat';
import { usePresence } from '../../hooks/usePresence';
import api from '../../services/api';
import toast from 'react-hot-toast';
import styles from './ClanChat.module.css';
import { FiMoreVertical, FiTrash2, FiEdit2, FiBookmark, FiSearch } from 'react-icons/fi';

// Emoji picker data
const EMOJI_CATEGORIES = {
  smileys: ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😚', '😙'],
  gestures: ['👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🫰', '🤟', '🤘', '🤙', '👍', '👎', '👊', '👏', '🙌', '👐'],
  hearts: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '💌', '💢'],
  objects: ['⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎳', '🎯', '🎮', '🎲', '🎰', '🧩', '🚗', '🚕', '🚙', '🚌', '🚎'],
  nature: ['🌲', '🌳', '🌴', '🌵', '🌾', '🌿', '☘️', '🍀', '🎍', '🎎', '🎏', '🎐', '🎑', '🌍', '🌎', '🌏', '💮', '🌸', '🌼', '🌻']
};

const COMMON_EMOJIS = ['😀', '😂', '❤️', '👍', '🔥', '💯', '✨', '🎉', '😍', '🤔'];

// ============================================================================
// UTILITIES
// ============================================================================

const formatDateLabel = (dateString) => {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  
  return date.toLocaleDateString('en-US', { 
    month: 'long', 
    day: 'numeric', 
    year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined 
  });
};

const groupMessages = (messages, lastSeenId) => {
  const grouped = [];
  let lastDate = null;
  let lastMessage = null;

  const lastSeenIndex = lastSeenId ? messages.findIndex(m => m._id === lastSeenId) : -1;
  const firstUnreadIndex = (lastSeenId && lastSeenIndex !== -1) ? lastSeenIndex + 1 : -1;

  messages.forEach((msg, index) => {
    // Check for unread divider
    if (index === firstUnreadIndex) {
      grouped.push({ type: 'unreadDivider' });
    }

    const msgDate = new Date(msg.createdAt).toDateString();
    
    // Check if we need a date divider
    if (msgDate !== lastDate) {
      grouped.push({ type: 'dateDivider', date: formatDateLabel(msg.createdAt) });
      lastDate = msgDate;
      lastMessage = null; // Reset grouping on day change
    }

    let isGrouped = false;
    if (lastMessage) {
      const lastSenderId = lastMessage.sender?._id || lastMessage.sender?.id;
      const currentSenderId = msg.sender?._id || msg.sender?.id;
      const timeDiff = (new Date(msg.createdAt) - new Date(lastMessage.createdAt)) / 1000 / 60; // in minutes

      if (lastSenderId === currentSenderId && timeDiff < 5 && !msg.replyTo) {
        isGrouped = true;
      }
    }

    grouped.push({ type: 'message', data: msg, isGrouped });
    lastMessage = msg;
  });

  return grouped;
};

const UnreadDivider = () => (
  <div style={{ display: 'flex', alignItems: 'center', margin: '24px 0', padding: '0 16px' }}>
    <div style={{ flex: 1, height: '1px', background: '#e17055', opacity: 0.3 }} />
    <span style={{ padding: '0 12px', fontSize: '11px', fontWeight: 'bold', color: '#e17055', textTransform: 'uppercase', letterSpacing: '2px' }}>
      New Messages
    </span>
    <div style={{ flex: 1, height: '1px', background: '#e17055', opacity: 0.3 }} />
  </div>
);

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

const getAvatarColor = (char) => {
  const colorMap = {
    'A': '#534AB7', 'B': '#534AB7', 'C': '#534AB7', 'D': '#534AB7',
    'E': '#1D9E75', 'F': '#1D9E75', 'G': '#1D9E75', 'H': '#1D9E75',
    'I': '#D85A30', 'J': '#D85A30', 'K': '#D85A30', 'L': '#D85A30',
    'M': '#BA7517', 'N': '#BA7517', 'O': '#BA7517', 'P': '#BA7517',
    'Q': '#185FA5', 'R': '#185FA5', 'S': '#185FA5', 'T': '#185FA5',
    'U': '#993556', 'V': '#993556', 'W': '#993556', 'X': '#993556',
    'Y': '#993556', 'Z': '#993556'
  };
  return colorMap[char?.toUpperCase()] || '#534AB7';
};

const DateDivider = ({ date }) => (
  <div style={{ display: 'flex', alignItems: 'center', margin: '24px 0', padding: '0 16px' }}>
    <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.05)' }} />
    <span style={{ padding: '0 12px', fontSize: '11px', fontWeight: 'bold', color: '#666680', textTransform: 'uppercase', letterSpacing: '1px' }}>
      {date}
    </span>
    <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.05)' }} />
  </div>
);

const PinnedMessagesPanel = ({ messages, onClose, onUnpin }) => (
  <div className={styles.pinnedPanel} style={{
    width: '280px',
    background: '#1a1a2e',
    borderLeft: '1px solid rgba(255,255,255,0.08)',
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    zIndex: 20
  }}>
    <div style={{ padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 'bold', color: '#e8e8f0' }}>📌 Pinned Messages</h3>
      <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#8888aa', cursor: 'pointer', fontSize: '20px' }}>×</button>
    </div>
    <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
      {messages.length === 0 ? (
        <div style={{ textAlign: 'center', marginTop: '40px', color: '#666680', fontSize: '12px' }}>No pinned messages yet</div>
      ) : (
        messages.map(msg => (
          <div key={msg._id} style={{ marginBottom: '12px', background: '#1e1e32', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '10px' }}>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
              <div style={{
                width: '28px', height: '28px', borderRadius: '4px', background: getAvatarColor(msg.sender?.username?.[0]),
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 'bold', color: '#fff'
              }}>
                {msg.sender?.username?.[0]?.toUpperCase()}
              </div>
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: '12px', fontWeight: 'bold', color: '#FAC775', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {msg.sender?.username}
                </p>
                <p style={{ margin: 0, fontSize: '10px', color: '#555570' }}>
                  {new Date(msg.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
            <p style={{
              margin: '0 0 10px 0', fontSize: '11px', color: '#c8c8e0', lineHeight: '1.4',
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'
            }}>
              {msg.content}
            </p>
            <button
              onClick={() => onUnpin(msg._id)}
              style={{ background: 'rgba(225,112,85,0.1)', border: 'none', color: '#e17055', padding: '3px 6px', borderRadius: '4px', fontSize: '10px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              Unpin
            </button>
          </div>
        ))
      )}
    </div>
  </div>
);

const MessageContent = ({ content, edited, isSending }) => {
  const parts = [];
  const regex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', value: content.substring(lastIndex, match.index) });
    }

    const filename = match[1];
    const url = match[2];
    const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(url);

    if (isImage) {
      parts.push({ type: 'image', filename, url });
    } else {
      parts.push({ type: 'file', filename, url });
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < content.length) {
    parts.push({ type: 'text', value: content.substring(lastIndex) });
  }

  return (
    <div style={{ wordBreak: 'break-word', whiteSpace: 'pre-wrap', color: isSending ? '#888899' : '#c8c8e0', opacity: isSending ? 0.7 : 1 }}>
      {parts.length === 0 ? content : parts.map((part, i) => {
        if (part.type === 'text') return <span key={i}>{part.value}</span>;
        if (part.type === 'image') return (
          <div key={i} style={{ marginTop: '6px', position: 'relative', display: 'inline-block', maxWidth: '100%' }}>
            <img 
              src={part.url} 
              alt={part.filename}
              onClick={() => window.open(part.url, '_blank')}
              style={{ 
                maxWidth: '300px', maxHeight: '200px', borderRadius: '8px', 
                cursor: 'pointer', display: 'block', border: '1px solid rgba(255,255,255,0.05)',
                background: '#1e1e32', minWidth: '100px', minHeight: '60px'
              }}
              onLoad={(e) => e.target.style.background = 'transparent'}
            />
          </div>
        );
        if (part.type === 'file') {
          const ext = part.filename.split('.').pop()?.toLowerCase();
          let icon = '📎';
          if (['pdf', 'doc', 'docx', 'txt'].includes(ext)) icon = '📄';
          if (['zip', 'rar', '7z'].includes(ext)) icon = '🗜';
          
          return (
            <div key={i} style={{ 
              background: '#1e1e32', border: '1px solid rgba(255,255,255,0.05)', 
              borderRadius: '8px', padding: '10px', marginTop: '6px', 
              display: 'flex', alignItems: 'center', gap: '12px', maxWidth: '350px' 
            }}>
              <span style={{ fontSize: '20px' }}>{icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: '12px', color: '#e8e8f0', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {part.filename}
                </p>
                <span style={{ fontSize: '10px', color: '#8888aa', textTransform: 'uppercase' }}>{ext}</span>
              </div>
              <a 
                href={part.url} target="_blank" rel="noopener noreferrer" 
                style={{ color: '#6c5ce7', fontSize: '12px', fontWeight: 'bold', textDecoration: 'none' }}
              >
                Download
              </a>
            </div>
          );
        }
        return null;
      })}
      {edited && <span style={{ fontSize: '10px', color: '#666680', marginLeft: '6px' }}>(edited)</span>}
    </div>
  );
};

const ReactionPill = ({ emoji, count, onReact }) => (
  <button
    onClick={onReact}
    className={styles.reactionPill}
    style={{
      background: '#1e1e32',
      border: '0.5px solid rgba(255,255,255,0.1)',
      borderRadius: '20px',
      padding: '3px 8px',
      fontSize: '11px',
      cursor: 'pointer',
      color: '#e8e8f0',
      display: 'flex',
      alignItems: 'center',
      gap: '4px'
    }}
  >
    {emoji} {count}
  </button>
);

const EmojiPicker = ({ onSelectEmoji, onClose }) => {
  const [activeCategory, setActiveCategory] = useState('smileys');
  const pickerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={pickerRef}
      style={{
        position: 'absolute', bottom: '100%', left: 0,
        background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '8px', padding: '8px', marginBottom: '8px',
        zIndex: 1000, width: '280px'
      }}
    >
      <div style={{ display: 'flex', gap: '4px', marginBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px' }}>
        {Object.keys(EMOJI_CATEGORIES).map(cat => (
          <button key={cat} onClick={() => setActiveCategory(cat)}
            style={{
              padding: '4px 8px',
              background: activeCategory === cat ? '#534AB7' : 'transparent',
              border: 'none', borderRadius: '4px', color: '#e8e8f0',
              cursor: 'pointer', fontSize: '12px', textTransform: 'capitalize'
            }}
          >
            {cat.substring(0, 3)}
          </button>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '4px' }}>
        {EMOJI_CATEGORIES[activeCategory].map((emoji, idx) => (
          <button key={idx} onClick={() => { onSelectEmoji(emoji); onClose(); }}
            style={{ background: 'transparent', border: 'none', fontSize: '20px', cursor: 'pointer', padding: '4px', borderRadius: '4px' }}
            onMouseEnter={(e) => e.target.style.background = '#2a2a3e'}
            onMouseLeave={(e) => e.target.style.background = 'transparent'}
          >
            {emoji}
          </button>
        ))}
      </div>
      <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
        <p style={{ fontSize: '11px', color: '#8888aa', margin: '0 0 4px 0' }}>Recently used</p>
        <div style={{ display: 'flex', gap: '4px' }}>
          {COMMON_EMOJIS.map((emoji, idx) => (
            <button key={idx} onClick={() => { onSelectEmoji(emoji); onClose(); }}
              style={{ background: 'transparent', border: 'none', fontSize: '18px', cursor: 'pointer', padding: '4px', borderRadius: '4px' }}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

const MessageActionsTray = ({ message, isCurrentUser, onEdit, onDelete, onQuickReact, onOpenPicker, onPin, onReply }) => {
  const actions = [
    { icon: '😊', title: 'React',  onClick: onOpenPicker },
    { icon: '↩',  title: 'Reply',  onClick: onReply },
    ...(isCurrentUser ? [{ icon: '✏', title: 'Edit', onClick: onEdit }] : []),
    { icon: '📌', title: 'Pin',    onClick: onPin },
    { icon: '🗑',  title: 'Delete', onClick: onDelete, danger: true },
  ];

  return (
    <div style={{
      position: 'absolute', top: '-22px', right: '16px',
      background: '#1e1e32', border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '8px', padding: '3px 6px',
      display: 'flex', alignItems: 'center', gap: '2px', zIndex: 50,
      boxShadow: '0 4px 16px rgba(0,0,0,0.4)'
    }}>
      <div style={{ display: 'flex', gap: '1px', borderRight: '1px solid rgba(255,255,255,0.1)', marginRight: '4px', paddingRight: '4px' }}>
        {COMMON_EMOJIS.slice(0, 6).map(emoji => (
          <button
            key={emoji}
            onClick={() => onQuickReact(emoji)}
            style={{
              width: '24px', height: '24px', background: 'transparent', border: 'none',
              borderRadius: '4px', cursor: 'pointer', fontSize: '15px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'transform 0.15s, background 0.15s'
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#2a2a3e'; e.currentTarget.style.transform = 'scale(1.2)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.transform = 'scale(1)'; }}
          >
            {emoji}
          </button>
        ))}
      </div>
      {actions.map(({ icon, title, onClick, danger }) => (
        <button key={title} title={title} onClick={onClick}
          style={{
            width: '28px', height: '28px', background: 'transparent', border: 'none',
            borderRadius: '6px', cursor: 'pointer', fontSize: '14px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: danger ? '#e17055' : '#9090b8', transition: 'background 0.15s, color 0.15s'
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#2a2a3e'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          {icon}
        </button>
      ))}
    </div>
  );
};

const MessageItem = ({ message, isCurrentUser, onReact, onEdit, onDelete, onPin, onSaveEdit, onReply, isGrouped }) => {
  const avatarColor = isCurrentUser ? '#1D9E75' : getAvatarColor(message.sender?.username?.[0]);
  const initials = isCurrentUser ? 'ME' : (message.sender?.username?.substring(0, 2).toUpperCase() || '??');
  const [showActions, setShowActions] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(message.content);
  const messageRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (messageRef.current && !messageRef.current.contains(event.target)) {
        setShowActions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getRoleColor = () => {
    if (isCurrentUser) return '#5DCAA5';
    if (message.sender?.role === 'owner') return '#FAC775';
    if (message.sender?.role === 'mod') return '#AFA9EC';
    return '#e8e8f0';
  };

  const getRoleBadge = () => {
    if (message.sender?.role === 'owner') return { bg: '#3d2a00', color: '#FAC775', border: '0.5px solid #BA7517', text: 'Owner' };
    if (message.sender?.role === 'mod') return { bg: '#2a1a4a', color: '#AFA9EC', border: '0.5px solid #7F77DD', text: 'Mod' };
    return null;
  };

  const badge = getRoleBadge();

  const handleEditKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSaveEdit?.(message._id, editValue.trim());
      setIsEditing(false);
    }
    if (e.key === 'Escape') {
      setEditValue(message.content);
      setIsEditing(false);
    }
  };

  return (
    <div
      ref={messageRef}
      className={styles.messageRow}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => { if (!showEmojiPicker) setShowActions(false); }}
      style={{ 
        position: 'relative', 
        marginTop: isGrouped ? '2px' : '16px',
        padding: isGrouped ? '2px 0 2px 0' : '8px 0',
        minHeight: isGrouped ? 'unset' : '48px'
      }}
    >
      {!isGrouped ? (
        <div className={styles.messageAvatar} style={{ background: avatarColor, opacity: message.status === 'failed' ? 0.5 : 1 }}>
          {initials}
        </div>
      ) : (
        <div style={{ width: '40px', textAlign: 'right', paddingRight: '12px', opacity: showActions ? 1 : 0, transition: 'opacity 0.15s', flexShrink: 0 }}>
          <span style={{ fontSize: '10px', color: '#555570', fontFamily: 'monospace' }}>
            {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
          </span>
        </div>
      )}

      <div className={styles.messageBody}>
        {!isGrouped && (
          <div className={styles.messageHeader}>
            <span className={styles.username} style={{ color: getRoleColor() }}>
              {isCurrentUser ? 'You' : message.sender?.username}
            </span>

            {badge && (
              <span className={styles.roleBadge} style={{ background: badge.bg, color: badge.color, border: badge.border }}>
                {badge.text}
              </span>
            )}

            <span className={styles.timestamp}>
              {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>

            {isCurrentUser && message.status === 'delivered' && <span className={styles.deliveryStatus}>· delivered</span>}
            {message.status === 'sending' && <span className={styles.sendingStatus}>· sending...</span>}
            {message.status === 'failed' && (
              <button onClick={() => onReact?.(message._id, 'retry')} className={styles.retryButton}>
                · failed — retry
              </button>
            )}

            {showActions && (
              <button
                onClick={(e) => { e.stopPropagation(); setShowActions(v => !v); }}
                style={{ background: 'transparent', border: 'none', color: '#8888aa', cursor: 'pointer', padding: '0 4px', marginLeft: 'auto' }}
                title="Message actions"
              >
                <FiMoreVertical size={16} />
              </button>
            )}
          </div>
        )}

        {/* Inline edit mode */}
        {isEditing ? (
          <div style={{ marginTop: '4px' }}>
            <input
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleEditKeyDown}
              autoFocus
              style={{
                width: '100%', padding: '6px 10px', background: '#2a2a3e',
                border: '1px solid #534AB7', borderRadius: '4px',
                color: '#e8e8f0', fontSize: '13px'
              }}
            />
            <p style={{ fontSize: '11px', color: '#8888aa', marginTop: '4px' }}>
              Enter to save · Esc to cancel
            </p>
          </div>
        ) : (
          <>
            {message.replyTo && (
              <div style={{
                background: '#2a2a3e',
                borderLeft: '2px solid #6c5ce7',
                padding: '4px 10px',
                borderRadius: '4px',
                marginBottom: '6px',
                marginTop: '4px',
                fontSize: '12px',
                maxWidth: 'fit-content'
              }}>
                <div style={{ color: '#6c5ce7', fontWeight: 'bold', fontSize: '11px' }}>
                  @{message.replyTo.sender?.username}
                </div>
                <div style={{ color: '#8888aa', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '300px' }}>
                  {message.replyTo.content}
                </div>
              </div>
            )}
            <MessageContent 
              content={message.content} 
              edited={message.edited} 
              isSending={message.status === 'sending'} 
            />
          </>
        )}

        {message.reactions && message.reactions.length > 0 && (
          <div className={styles.reactionsRow}>
            {message.reactions.map((reaction, idx) => (
              <ReactionPill key={idx} emoji={reaction.emoji} count={reaction.count} onReact={() => onReact?.(message._id, reaction.emoji)} />
            ))}
            {showActions && (
              <button onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                style={{ background: '#1e1e32', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: '20px', padding: '3px 8px', fontSize: '14px', cursor: 'pointer', color: '#e8e8f0' }}
                title="Add reaction"
              >+</button>
            )}
          </div>
        )}

        {showEmojiPicker && (
          <div style={{ position: 'relative', marginTop: '8px' }}>
            <EmojiPicker onSelectEmoji={(emoji) => { onReact?.(message._id, emoji); setShowEmojiPicker(false); }} onClose={() => setShowEmojiPicker(false)} />
          </div>
        )}

        {showActions && (
          <MessageActionsTray
            message={message}
            isCurrentUser={isCurrentUser}
            onEdit={() => { setIsEditing(true); setShowActions(false); }}
            onDelete={() => { onDelete?.(message._id); setShowActions(false); }}
            onQuickReact={(emoji) => { onReact?.(message._id, emoji); }}
            onOpenPicker={() => { setShowEmojiPicker(v => !v); }}
            onPin={() => { onPin?.(message._id); setShowActions(false); }}
            onReply={() => { onReply?.(message); setShowActions(false); }}
          />
        )}
      </div>
    </div>
  );
};

const MemberSidebarRow = ({ member, isOnline }) => {
  const avatarColor = getAvatarColor(member.user?.username?.[0]);
  const initials = member.user?.username?.substring(0, 2).toUpperCase() || '??';

  const getRoleBadge = () => {
    if (member.role === 'owner') return { bg: '#3d2a00', color: '#FAC775', border: '0.5px solid #BA7517', text: 'Owner' };
    if (member.role === 'mod') return { bg: '#2a1a4a', color: '#AFA9EC', border: '0.5px solid #7F77DD', text: 'Mod' };
    return null;
  };

  const badge = getRoleBadge();

  return (
    <div className={styles.memberRow} style={{ opacity: isOnline ? 1 : 0.4 }}>
      <div className={styles.memberAvatar} style={{ background: avatarColor }}>{initials}</div>
      <span className={styles.memberUsername} style={{ color: isOnline ? '#e8e8f0' : '#555570' }}>{member.user?.username}</span>
      {badge && (
        <span className={styles.memberRoleBadge} style={{ background: badge.bg, color: badge.color, border: badge.border }}>
          {badge.text}
        </span>
      )}
    </div>
  );
};

const TypingIndicator = ({ typingUsers, currentUserId }) => {
  const filteredUsers = typingUsers?.filter(u => u !== currentUserId) || [];

  if (filteredUsers.length === 0) return <div className={styles.typingIndicator} />;

  const text =
    filteredUsers.length === 1 ? `${filteredUsers[0]} is typing` :
    filteredUsers.length === 2 ? `${filteredUsers[0]} and ${filteredUsers[1]} are typing` :
    'Several people are typing';

  return (
    <div className={styles.typingIndicator}>
      {[0, 1, 2].map(i => (
        <span key={i} className={styles.typingDot} style={{ animationDelay: `${i * 0.2}s` }} />
      ))}
      {text}...
    </div>
  );
};

// forwardRef so parent can focus the input
const ChatInput = forwardRef(({ value, onChange, onSend, disabled, isMuted, muteUntil, onAttachmentUpload, members, replyTo, onCancelReply, isReadOnly }, ref) => {
  const fileInputRef = useRef(null);
  const localRef = useRef(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');

  // Use the combined ref handle
  const setRefs = (node) => {
    localRef.current = node;
    if (typeof ref === 'function') ref(node);
    else if (ref) ref.current = node;
  };

  useEffect(() => {
    const textarea = localRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    const newHeight = Math.min(textarea.scrollHeight, 120);
    textarea.style.height = newHeight + 'px';
    textarea.style.overflowY = textarea.scrollHeight > 120 ? 'auto' : 'hidden';
  }, [value]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  const handleInputChange = (e) => {
    const text = e.target.value;
    onChange(e);
    const lastAtIndex = text.lastIndexOf('@');
    if (lastAtIndex !== -1) {
      const afterAt = text.substring(lastAtIndex + 1);
      if (!afterAt.includes(' ')) {
        setMentionQuery(afterAt);
        setShowMentions(true);
      } else {
        setShowMentions(false);
      }
    } else {
      setShowMentions(false);
    }
  };

  const handleEmojiSelect = (emoji) => {
    onChange({ target: { value: value + emoji } });
    setShowEmojiPicker(false);
  };

  const handleMentionSelect = (username) => {
    const lastAtIndex = value.lastIndexOf('@');
    const newValue = value.substring(0, lastAtIndex) + '@' + username + ' ';
    onChange({ target: { value: newValue } });
    setShowMentions(false);
    ref?.current?.focus();
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error('File size must be less than 10MB'); return; }
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await api.post('/api/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      if (response.success) {
        onChange({ target: { value: value + ` [${file.name}](${response.data.url})` } });
        toast.success('File uploaded successfully');
      }
    } catch (error) {
      toast.error('Failed to upload file');
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const filteredMembers = members?.filter(m => m.user?.username?.toLowerCase().includes(mentionQuery.toLowerCase())) || [];

  if (isReadOnly) {
    return (
      <div style={{
        padding: '12px 16px',
        background: '#13131f',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        color: '#52526e',
        fontSize: '13px'
      }}>
        <span style={{ fontSize: '16px' }}>🔒</span>
        Only moderators can post in announcement channels
      </div>
    );
  }

  return (
    <>
      {isMuted && (
        <div className={styles.muteBar}>You are muted until {new Date(muteUntil).toLocaleString()}</div>
      )}
      
      {replyTo && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#1e1e32',
          padding: '8px 16px',
          borderLeft: '4px solid #6c5ce7',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          borderRadius: '8px 8px 0 0',
          margin: '0 8px'
        }}>
          <div style={{ overflow: 'hidden' }}>
            <p style={{ fontSize: '11px', color: '#6c5ce7', margin: 0, fontWeight: 'bold' }}>
              Replying to @{replyTo.sender?.username}
            </p>
            <p style={{ fontSize: '10px', color: '#8888aa', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {replyTo.content}
            </p>
          </div>
          <button 
            onClick={onCancelReply}
            style={{ background: 'transparent', border: 'none', color: '#8888aa', cursor: 'pointer', fontSize: '16px', padding: '0 4px' }}
          >
            ×
          </button>
        </div>
      )}

      <div className={styles.inputRow} style={{ position: 'relative' }}>
        <button className={styles.iconButton} title="Attachments" onClick={() => fileInputRef.current?.click()} type="button">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 0 19.8 4.3M22 12.5a10 10 0 0 0-19.8-4.2" />
          </svg>
        </button>
        <input ref={fileInputRef} type="file" onChange={handleFileSelect} style={{ display: 'none' }} accept="image/*,.pdf,.doc,.docx,.txt,.zip" />

        <button className={styles.iconButton} title="Emoji" onClick={() => setShowEmojiPicker(!showEmojiPicker)} type="button">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01" />
          </svg>
        </button>

        {showEmojiPicker && (
          <div style={{ position: 'absolute', bottom: '100%', left: '40px', marginBottom: '8px' }}>
            <EmojiPicker onSelectEmoji={handleEmojiSelect} onClose={() => setShowEmojiPicker(false)} />
          </div>
        )}

        <div className={styles.inputWrapper}>
          <textarea
            ref={setRefs}
            value={value}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            disabled={disabled || isMuted}
            placeholder={isMuted ? 'You are muted' : 'Message #general... (type @ to mention)'}
            className={styles.textInput}
            rows={1}
            style={{
              color: isMuted ? '#D85A30' : '#e8e8f0',
              resize: 'none',
              maxHeight: '120px',
              overflowY: 'auto',
              lineHeight: '1.5',
              display: 'block'
            }}
          />
          {value.length > 1800 && (
            <div style={{
              fontSize: '11px',
              color: value.length > 1950 ? '#e17055' : '#52526e',
              textAlign: 'right',
              marginTop: '2px',
              paddingRight: '4px'
            }}>
              {value.length} / 2000
            </div>
          )}
          {showMentions && filteredMembers.length > 0 && (
            <div style={{
              position: 'absolute', bottom: '100%', left: 0, right: 0,
              background: '#1e1e32', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '6px', maxHeight: '150px', overflowY: 'auto',
              marginBottom: '4px', zIndex: 100
            }}>
              {filteredMembers.slice(0, 5).map(member => (
                <button key={member._id} onClick={() => handleMentionSelect(member.user.username)}
                  style={{ width: '100%', padding: '8px 12px', background: 'transparent', border: 'none', color: '#e8e8f0', textAlign: 'left', cursor: 'pointer', fontSize: '13px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#2a2a3e'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  @{member.user.username}
                </button>
              ))}
            </div>
          )}
        </div>

        <button onClick={onSend} disabled={disabled || isMuted || !value.trim()} className={styles.sendButton} type="button"
          style={{ background: (value.trim() && !disabled && !isMuted) ? '#6c5ce7' : '#1e1e32', cursor: (value.trim() && !disabled && !isMuted) ? 'pointer' : 'not-allowed' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M16.6915026,12.4744748 L3.50612381,13.2599618 C3.19218622,13.2599618 3.03521743,13.4170592 3.03521743,13.5741566 L1.15159189,20.0151496 C0.8376543,20.8006365 0.99,21.89 1.77946707,22.52 C2.41,22.99 3.50612381,23.1 4.13399899,22.8429026 L21.714504,14.0454487 C22.6563168,13.5741566 23.1272231,12.6315722 22.9702544,11.6889879 L4.13399899,1.16346272 C3.34915502,0.9 2.40734225,1.00636533 1.77946707,1.4776575 C0.994623095,2.10604706 0.837654326,3.0486314 1.15159189,3.99701575 L3.03521743,10.4380088 C3.03521743,10.5951061 3.19218622,10.7522035 3.50612381,10.7522035 L16.6915026,11.5376905 C16.6915026,11.5376905 17.1624089,11.5376905 17.1624089,12.0089827 C17.1624089,12.4744748 16.6915026,12.4744748 16.6915026,12.4744748 Z" />
          </svg>
        </button>
      </div>
    </>
  );
});
ChatInput.displayName = 'ChatInput';

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const ClanChat = () => {
  const { id: clanId } = useParams();
  const navigate = useNavigate();
  const { myClan, clearUnread } = useClan();
  const { user } = useAuth();
  const { messages, sendMessage, editMessage, typingUsers, sendTyping } = useChat(clanId);
  const presence = usePresence(clanId);

  // Refs moved to top
  const messagesContainerRef = useRef(null);
  const bottomAnchorRef = useRef(null);
  const inputRef = useRef(null);

  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [messageInput, setMessageInput] = useState('');
  const [sending, setSending] = useState(false);
  const [showNewMessages, setShowNewMessages] = useState(false);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [showPinned, setShowPinned] = useState(false);
  const [pinnedMessages, setPinnedMessages] = useState([]);
  
  // Pagination State
  const [olderMessages, setOlderMessages] = useState([]);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [oldestMessageId, setOldestMessageId] = useState(null);
  const [lastScrollHeight, setLastScrollHeight] = useState(0);

  // Unread State
  const [lastSeenId] = useState(() => localStorage.getItem(`clan_last_seen_${clanId}`));
  const [hasClearedUnread, setHasClearedUnread] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const membersRes = await api.get(`/api/clans/${clanId}/members?limit=100`);
      if (membersRes.success) setMembers(membersRes.data.members);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load chat');
    } finally {
      setLoading(false);
    }
  }, [clanId]);

  const fetchPinnedMessages = useCallback(async () => {
    try {
      const response = await api.get(`/api/clans/${clanId}/messages/pinned`);
      if (response.success) setPinnedMessages(response.data.messages);
    } catch (error) {
      console.error('Error fetching pinned messages:', error);
    }
  }, [clanId]);

  useEffect(() => {
    if (clanId) fetchData();
  }, [clanId, fetchData]);

  useEffect(() => {
    if (showPinned) fetchPinnedMessages();
  }, [showPinned, fetchPinnedMessages]);

  useEffect(() => {
    if (messages.length > 0 && !oldestMessageId && olderMessages.length === 0) {
      setOldestMessageId(messages[0]._id);
    }
  }, [messages, oldestMessageId, olderMessages.length]);

  const loadMoreMessages = useCallback(async () => {
    if (loadingMore || !hasMore || !oldestMessageId) return;

    const container = messagesContainerRef.current;
    if (container) {
      setLastScrollHeight(container.scrollHeight);
    }

    setLoadingMore(true);
    try {
      const response = await api.get(`/api/clans/${clanId}/messages?before=${oldestMessageId}&limit=30`);
      if (response.success) {
        const newBatch = response.data.messages;
        if (newBatch.length < 30) {
          setHasMore(false);
        }
        if (newBatch.length > 0) {
          setOlderMessages(prev => [...newBatch, ...prev]);
          setOldestMessageId(newBatch[0]._id);
        } else {
          setHasMore(false);
        }
      }
    } catch (error) {
      console.error('Error loading more messages:', error);
    } finally {
      setLoadingMore(false);
    }
  }, [clanId, oldestMessageId, loadingMore, hasMore]);

  useLayoutEffect(() => {
    if (lastScrollHeight > 0 && messagesContainerRef.current) {
      const container = messagesContainerRef.current;
      container.scrollTop = container.scrollHeight - lastScrollHeight;
      setLastScrollHeight(0);
    }
  }, [olderMessages, lastScrollHeight]);

  // Resolve user id — Redux may store as _id or id
  const userId = user?._id || user?.id;

  useEffect(() => { clearUnread(); }, [clearUnread]);

  useEffect(() => {
    if (!loading && inputRef.current) inputRef.current.focus();
  }, [loading]);

  useEffect(() => {
    if (isNearBottom && messages.length > 0) {
      setTimeout(() => bottomAnchorRef.current?.scrollIntoView({ behavior: 'smooth' }), 0);
      setShowNewMessages(false);
    } else if (messages.length > 0) {
      setShowNewMessages(true);
    }
  }, [messages, isNearBottom]);

  useEffect(() => {
    if (isNearBottom && messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      localStorage.setItem(`clan_last_seen_${clanId}`, lastMsg._id);
      setHasClearedUnread(true);
    }
  }, [isNearBottom, messages, clanId]);

  const handleScroll = useCallback(() => {
    if (!messagesContainerRef.current) return;
    const { scrollHeight, scrollTop, clientHeight } = messagesContainerRef.current;
    setIsNearBottom(scrollHeight - scrollTop - clientHeight < 100);
    
    if (scrollTop < 80 && hasMore && !loadingMore && oldestMessageId) {
      loadMoreMessages();
    }
  }, [hasMore, loadingMore, oldestMessageId, loadMoreMessages]);

  const handleSendMessage = useCallback(() => {
    if (!messageInput.trim()) return;
    setSending(true);
    sendMessage(messageInput.trim(), replyTo?._id);
    setMessageInput('');
    setReplyTo(null);
    setSending(false);
    sendTyping(false);
  }, [messageInput, sendMessage, sendTyping, replyTo]);

  const handleInputChange = useCallback((e) => {
    setMessageInput(e.target.value);
    sendTyping(true);
  }, [sendTyping]);

  const handleSaveEdit = useCallback(async (messageId, newContent) => {
    if (!newContent) return;
    try {
      // Try hook first, fall back to direct API
      if (typeof editMessage === 'function') {
        editMessage(messageId, newContent);
      } else {
        await api.put(`/api/clans/${clanId}/messages/${messageId}`, { content: newContent });
      }
      toast.success('Message updated');
    } catch (error) {
      toast.error('Failed to edit message');
    }
  }, [clanId, editMessage]);

  const handleDeleteMessage = useCallback(async (messageId) => {
    if (!window.confirm('Delete this message?')) return;
    try {
      const response = await api.delete(`/api/clans/${clanId}/messages/${messageId}`);
      if (response.success) toast.success('Message deleted');
    } catch (error) {
      toast.error('Failed to delete message');
    }
  }, [clanId]);

  const handlePinMessage = useCallback(async (messageId) => {
    try {
      const response = await api.post(`/api/clans/${clanId}/messages/${messageId}/pin`);
      if (response.success) {
        toast.success('Message pinned');
        const pinnedMsg = messages.find(m => m._id === messageId);
        if (pinnedMsg) setPinnedMessages(prev => [...prev, pinnedMsg]);
      }
    } catch (error) {
      toast.error('Failed to pin message');
    }
  }, [clanId, messages]);

  const handleUnpinMessage = useCallback(async (messageId) => {
    try {
      const response = await api.delete(`/api/clans/${clanId}/messages/${messageId}/pin`);
      if (response.success) {
        toast.success('Message unpinned');
        setPinnedMessages(prev => prev.filter(m => m._id !== messageId));
      }
    } catch (error) {
      toast.error('Failed to unpin message');
    }
  }, [clanId]);

  const handleReactToMessage = useCallback(async (messageId, emoji) => {
    try {
      await api.post(`/api/clans/${clanId}/messages/${messageId}/reactions`, { emoji });
    } catch (error) {
      toast.error('Failed to add reaction');
    }
  }, [clanId]);

  const allMessages = useMemo(() => [...olderMessages, ...messages], [olderMessages, messages]);

  const groupedItems = useMemo(() => 
    groupMessages(allMessages, hasClearedUnread ? null : lastSeenId), 
    [allMessages, lastSeenId, hasClearedUnread]
  );

  const filteredItems = useMemo(() => {
    return groupedItems.filter(item => {
      if (item.type !== 'message') return true;
      const msg = item.data;
      return msg.content?.toLowerCase().includes(searchQuery.toLowerCase()) ||
             msg.sender?.username?.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [groupedItems, searchQuery]);

  // Derived Role & Announcement Mode
  const myMember = members.find(m => m.user?._id === userId || m.user?.id === userId);
  const myRole = myMember?.role;
  const isModOrOwner = myRole === 'owner' || myRole === 'mod';
  const isAnnouncement = myClan?.clan?.channelType === 'announcement';
  const isReadOnly = isAnnouncement && !isModOrOwner;

  const onlineMembers = members.filter(m => presence?.[m.user?._id] === 'online');
  const offlineMembers = members.filter(m => presence?.[m.user?._id] !== 'online').slice(0, 10);
  const isMuted = myClan?.mutedUntil && new Date(myClan.mutedUntil) > new Date();
  const onlineCount = Object.values(presence || {}).filter(s => s === 'online').length;

  if (loading) {
    return <div className={styles.container}><div className={styles.loadingState}>Loading chat...</div></div>;
  }

  if (!myClan) {
    return (
      <div className={styles.container}>
        <div className={styles.errorState}>
          <p>You are not in a clan</p>
          <button onClick={() => navigate('/clans')} className={styles.errorButton}>Browse Clans</button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Left Sidebar */}
      <div className={styles.sidebar}>
        <div className={styles.clanPill}>
          <div className={styles.clanAvatar}>{myClan.clan.name.substring(0, 2).toUpperCase()}</div>
          <span className={styles.clanName}>{myClan.clan.name}</span>
        </div>
        <div className={styles.memberSection}>
          <div className={styles.sectionHeader}>ONLINE — {onlineMembers.length}</div>
          {onlineMembers.map(member => <MemberSidebarRow key={member._id} member={member} isOnline={true} />)}
        </div>
        {offlineMembers.length > 0 && (
          <div className={styles.memberSection}>
            <div className={styles.sectionHeader}>OFFLINE — {offlineMembers.length}</div>
            {offlineMembers.map(member => <MemberSidebarRow key={member._id} member={member} isOnline={false} />)}
          </div>
        )}
      </div>

      {/* Main Layout Area */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
        {/* Right Panel (Chat) */}
        <div className={styles.chatPanel}>
          {/* Channel Header */}
          <div className={styles.channelHeader}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <h2 className={styles.channelName}># general</h2>
                {isAnnouncement && (
                  <span style={{ fontSize: '11px', background: 'rgba(250,199,117,0.1)', 
                    color: '#FAC775', border: '0.5px solid #BA7517', borderRadius: '4px', 
                    padding: '1px 6px', marginLeft: '6px' }}>
                    📣 Announcement
                  </span>
                )}
              </div>
              <p className={styles.channelInfo}>{onlineCount} online · {members.length} members</p>
            </div>
            <div className={styles.headerButtons}>
              <button className={styles.headerButton} title="Search messages" onClick={() => setShowSearch(!showSearch)}>
                <FiSearch size={18} />
              </button>
              <button 
                className={styles.headerButton} 
                title="Pinned messages" 
                onClick={() => setShowPinned(!showPinned)}
                style={{ color: showPinned ? '#6c5ce7' : '#8888aa' }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill={showPinned ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                </svg>
              </button>
              <button className={styles.headerButton} title="Members" onClick={() => navigate(`/clans/${clanId}?tab=members`)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </button>
            </div>
          </div>

          {/* Search bar */}
          {showSearch && (
            <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)', background: '#1a1a2e' }}>
              <input
                type="text"
                placeholder="Search messages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', background: '#1e1e32', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#e8e8f0', fontSize: '13px' }}
                autoFocus
              />
            </div>
          )}

          {/* Messages Container */}
          <div ref={messagesContainerRef} onScroll={handleScroll} className={styles.messagesContainer}>
            {loadingMore && (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '16px' }}>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <style>{`
                    @keyframes load-bounce { to { transform: translateY(-4px); opacity: 1; } }
                  `}</style>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{ 
                      width: '6px', height: '6px', background: '#6c5ce7', borderRadius: '50%', opacity: 0.4,
                      animation: `load-bounce 0.6s infinite alternate ${i * 0.2}s`
                    }} />
                  ))}
                </div>
              </div>
            )}
            {!hasMore && !loadingMore && allMessages.length > 0 && (
              <div style={{ textAlign: 'center', padding: '24px 0 12px 0', color: '#666680', fontSize: '11px', fontWeight: '500' }}>
                — Beginning of conversation —
              </div>
            )}

            {filteredItems.length === 0 && !loadingMore ? (
              <div className={styles.emptyState}>
                <p>{searchQuery ? 'No messages found' : 'No messages yet'}</p>
                <p>{searchQuery ? 'Try a different search' : 'Start the conversation!'}</p>
              </div>
            ) : (
              <>
                {filteredItems.map((item, idx) => (
                  item.type === 'dateDivider' ? (
                    <DateDivider key={`date-${idx}`} date={item.date} />
                  ) : item.type === 'unreadDivider' ? (
                    <UnreadDivider key="unread-divider" />
                  ) : (
                    <MessageItem
                      key={item.data._id}
                      message={item.data}
                      isCurrentUser={item.data.sender?._id === userId || item.data.sender?.id === userId}
                      onReact={handleReactToMessage}
                      onSaveEdit={handleSaveEdit}
                      onDelete={handleDeleteMessage}
                      onPin={handlePinMessage}
                      onReply={setReplyTo}
                      isGrouped={item.isGrouped}
                    />
                  )
                ))}
                <div ref={bottomAnchorRef} />
              </>
            )}
          </div>

          <TypingIndicator typingUsers={typingUsers} currentUserId={userId} />

          <ChatInput
            ref={inputRef}
            value={messageInput}
            onChange={handleInputChange}
            onSend={handleSendMessage}
            disabled={sending}
            isMuted={isMuted}
            muteUntil={myClan?.mutedUntil}
            onAttachmentUpload={(url) => setMessageInput(messageInput + ` [attachment](${url})`)}
            members={members}
            replyTo={replyTo}
            onCancelReply={() => setReplyTo(null)}
            isReadOnly={isReadOnly}
          />

          {showNewMessages && (
            <button
              onClick={() => {
                bottomAnchorRef.current?.scrollIntoView({ behavior: 'smooth' });
                setShowNewMessages(false);
              }}
              style={{
                position: 'absolute',
                bottom: '90px',
                right: '24px',
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                background: '#6c5ce7',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10,
                opacity: showNewMessages ? 1 : 0,
                transform: showNewMessages ? 'translateY(0)' : 'translateY(10px)',
                pointerEvents: showNewMessages ? 'auto' : 'none',
                transition: 'opacity 0.2s, transform 0.2s',
                boxShadow: '0 4px 12px rgba(108,92,231,0.4)'
              }}
              title="Scroll to bottom"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <path d="M12 5v14M5 12l7 7 7-7" />
              </svg>
            </button>
          )}
        </div>

        {/* Pinned Messages Sidebar */}
        {showPinned && (
          <PinnedMessagesPanel 
            messages={pinnedMessages} 
            onClose={() => setShowPinned(false)}
            onUnpin={handleUnpinMessage}
          />
        )}
      </div>
    </div>
  );
};

export default ClanChat;
