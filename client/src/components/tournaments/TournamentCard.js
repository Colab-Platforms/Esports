import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiCalendar, FiUsers, FiDollarSign, FiClock, FiAward } from 'react-icons/fi';

const TournamentCard = ({ tournament }) => {
  const getGameTypeIcon = (gameType) => {
    switch (gameType) {
      case 'bgmi': return '🎮';
      case 'valorant': return '🎯';
      case 'cs2': return '⚡';
      default: return '🎮';
    }
  };

  const getStatusBadge = (status) => {
    // CS2 tournaments don't use registration terminology
    const isCS2 = tournament.gameType === 'cs2';
    
    const badges = {
      'registration_open': { 
        text: isCS2 ? 'Open' : 'Open', 
        class: 'badge-success' 
      },
      'upcoming': { 
        text: 'Upcoming', 
        class: 'badge-primary' 
      },
      'registration_closed': { 
        text: isCS2 ? 'Closed' : 'Closed', 
        class: 'badge-warning' 
      },
      'active': { 
        text: 'Live', 
        class: 'badge-success animate-pulse' 
      },
      'completed': { 
        text: 'Finished', 
        class: 'badge-secondary' 
      },
      'cancelled': { 
        text: 'Cancelled', 
        class: 'badge-danger' 
      }
    };
    
    const badge = badges[status] || badges.upcoming;
    return <span className={`badge ${badge.class}`}>{badge.text}</span>;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getProgressPercentage = () => {
    return Math.min((tournament.currentParticipants / tournament.maxParticipants) * 100, 100);
  };

  const isRegistrationOpen = () => {
    return tournament.status === 'registration_open' && 
           tournament.currentParticipants < tournament.maxParticipants;
  };

  return (
    <motion.div
      whileHover={{ y: -5, scale: 1.02 }}
      transition={{ duration: 0.2 }}
      className="tournament-card group"
    >
      {/* Header */}
      <div className="tournament-card-header">
        <div className="flex items-center space-x-2">
          <span className="text-2xl">{getGameTypeIcon(tournament.gameType)}</span>
          <div>
            <h3 className="tournament-card-title line-clamp-1">
              {tournament.name}
            </h3>
            <p className="text-sm text-gray-400 capitalize">
              {tournament.gameType} • {tournament.mode}
            </p>
          </div>
        </div>
        {getStatusBadge(tournament.status)}
      </div>

      {/* Description */}
      <p className="text-gray-400 text-sm mb-4 line-clamp-2">
        {tournament.description}
      </p>

      {/* Tournament Stats */}
      <div className="tournament-card-body">
        <div className="tournament-card-stat">
          <div className="flex items-center space-x-2 tournament-card-stat-label">
            <FiAward className="h-4 w-4" />
            <span>Prize Pool</span>
          </div>
          <span className="tournament-card-stat-value text-gaming-neon">
            ₹{tournament.prizePool.toLocaleString()}
          </span>
        </div>

        <div className="tournament-card-stat">
          <div className="flex items-center space-x-2 tournament-card-stat-label">
            <FiDollarSign className="h-4 w-4" />
            <span>Entry Fee</span>
          </div>
          <span className="tournament-card-stat-value">
            {tournament.entryFee === 0 ? 'Free' : `₹${tournament.entryFee}`}
          </span>
        </div>

        <div className="tournament-card-stat">
          <div className="flex items-center space-x-2 tournament-card-stat-label">
            <FiUsers className="h-4 w-4" />
            <span>Players</span>
          </div>
          <span className="tournament-card-stat-value">
            {tournament.currentParticipants}/{tournament.maxParticipants}
          </span>
        </div>

        <div className="tournament-card-stat">
          <div className="flex items-center space-x-2 tournament-card-stat-label">
            <FiCalendar className="h-4 w-4" />
            <span>Starts</span>
          </div>
          <span className="tournament-card-stat-value text-sm">
            {formatDate(tournament.startDate)}
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mt-4 mb-4">
        <div className="flex justify-between text-sm text-gray-400 mb-1">
          <span>Registration Progress</span>
          <span>{Math.round(getProgressPercentage())}%</span>
        </div>
        <div className="w-full bg-gaming-slate rounded-full h-2">
          <div
            className="bg-gradient-to-r from-gaming-neon to-gaming-neon-blue h-2 rounded-full transition-all duration-300"
            style={{ width: `${getProgressPercentage()}%` }}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="tournament-card-footer">
        <div className="flex items-center space-x-2 text-sm text-gray-400">
          <FiClock className="h-4 w-4" />
          <span>
            {tournament.status === 'registration_open' 
              ? `Reg. closes ${formatDate(tournament.registrationDeadline)}`
              : `${tournament.status.replace('_', ' ')}`
            }
          </span>
        </div>

        <div className="flex space-x-2">
          <Link
            to={`/tournaments/${tournament._id}`}
            className="btn-secondary btn-sm"
          >
            View Details
          </Link>
          
          {isRegistrationOpen() && (
            <Link
              to={`/tournaments/${tournament._id}`}
              className="btn-primary btn-sm"
            >
              Join Now
            </Link>
          )}
        </div>
      </div>

      {/* Featured Badge */}
      {tournament.featured && (
        <div className="absolute top-2 right-2">
          <span className="badge badge-gold text-xs">
            ⭐ Featured
          </span>
        </div>
      )}

      {/* Full Badge */}
      {tournament.currentParticipants >= tournament.maxParticipants && (
        <div className="absolute top-2 left-2">
          <span className="badge badge-danger text-xs">
            Full
          </span>
        </div>
      )}
    </motion.div>
  );
};

export default TournamentCard;