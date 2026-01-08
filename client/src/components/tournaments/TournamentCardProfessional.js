import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import CountdownTimer from '../common/CountdownTimer';

const TournamentCardProfessional = ({ 
  tournament, 
  getModeIcon, 
  getStatusColor, 
  formatDate,
  showTimer = true,
  gameType = 'bgmi',
  hideBottomInfo = false
}) => {
  const navigate = useNavigate();
  const isRegistrationClosed = tournament.status === 'registration_closed';
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="relative w-full aspect-[4/5] overflow-hidden border border-gaming-gold/70 hover:border-gaming-gold transition-all duration-300 group bg-gradient-to-br from-gaming-charcoal via-gaming-dark to-gaming-darker shadow-xl hover:shadow-gaming-gold/40"
      style={{
        clipPath: 'polygon(16px 0, calc(100% - 16px) 0, 100% 16px, 100% calc(100% - 16px), calc(100% - 16px) 100%, 16px 100%, 0 calc(100% - 16px), 0 16px)'
      }}
    >
      {/* Background Image */}
      <div className="absolute inset-0">
        {tournament.bannerImage ? (
          <img 
            src={tournament.bannerImage} 
            alt={tournament.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : gameType === 'cs2' ? (
          <img 
            src="https://gameplayscassi.com.br/wp-content/smush-webp/2023/03/Rumores-indicam-que-a-beta-do-Counter-Strike-2-pode-ser-lancada-em-1o-de-abril..jpg.webp"
            alt={tournament.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <img 
            src="https://cdn.shopify.com/s/files/1/0636/5226/6115/files/Post.jpg?v=1767875878"
            alt={tournament.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        )}
        {/* Dark overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/60 to-black/85" />
      </div>

      {/* Top Left - Registration Closed Chip & Timer */}
      <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between">
        {isRegistrationClosed && (
          <div className="px-3 py-1.5 border border-gaming-gold/60 text-xs font-display font-bold text-gaming-gold">
            REGISTRATION CLOSED
          </div>
        )}
        
        {/* Timer - Show if tournament hasn't started yet and showTimer is true */}
        {showTimer && tournament?.startDate && new Date(tournament.startDate) > new Date() && (
          <div className="px-3 py-1.5 backdrop-blur-md border border-blue-400/50 rounded-full text-xs font-display font-bold text-white">
            <CountdownTimer 
              targetDate={tournament.startDate}
              format="compact"
              size="sm"
              showLabels={false}
              className="text-white"
            />
          </div>
        )}
      </div>

      {/* Content Container */}
      <div className="absolute inset-0 flex flex-col justify-between p-5">
        {/* Top Section - Status Badge */}
        {!isRegistrationClosed && (
          <div className="flex justify-end">
            <div className={`px-2.5 py-1 rounded-full text-xs font-display font-bold ${getStatusColor(tournament.status)}`}>
              {tournament.status === 'completed' ? 'FINISHED' : tournament.status.replace('_', ' ').toUpperCase()}
            </div>
          </div>
        )}

        {/* Middle Section - Tournament Name */}
        <div className="flex flex-col items-center justify-center text-center">
          {gameType === 'cs2' && <h3 className="text-white font-display text-2xl font-bold mb-2 line-clamp-2 drop-shadow-lg tracking-wide">
            {tournament.name}
          </h3>}
          {/* <div className="text-gaming-gold font-display text-xs font-bold tracking-widest opacity-80">
            {tournament.mode?.toUpperCase() || 'SQUAD'}
          </div> */}
        </div>

        {/* Bottom Section - Info Bar */}
        <div className="space-y-2.5">
          {!hideBottomInfo && (
            <>
              {/* Prize Pool & Entry Fee Row */}
              <div className="flex justify-between items-center text-xs">
                {gameType !== 'cs2' && <div className="flex items-center space-x-1.5">
                  <span className="text-gaming-gold font-display font-bold">PRIZE:</span>
                  <span className="text-white font-display font-bold">₹{(tournament.prizePool / 1000).toFixed(0)}K</span>
                </div>}
                <div className="flex items-center space-x-1.5">
                  <span className="text-gaming-gold font-display font-bold">ENTRY:</span>
                  <span className="text-white font-display font-bold">₹{tournament.entryFee}</span>
                </div>
              </div>

              {/* Players & Registration Row */}
              <div className="flex justify-between items-center text-xs">
                <div className="flex items-center space-x-1.5">
                  <span className="text-gaming-gold font-display font-bold">PLAYERS:</span>
                  <span className="text-white font-display font-bold">{tournament.currentParticipants}/{tournament.maxParticipants}</span>
                </div>
                {gameType !== 'cs2' && <div className="flex items-center space-x-1.5">
                  <span className="text-gaming-gold font-display font-bold">REG:</span>
                  <span className="text-gaming-neon font-display font-bold">{Math.round((tournament.currentParticipants / tournament.maxParticipants) * 100)}%</span>
                </div>}
              </div>

              {/* Divider Line */}
              {gameType !== 'cs2' && <div className="h-px bg-gradient-to-r from-gaming-gold/20 via-gaming-gold/40 to-gaming-gold/20" />}

              {/* Dates Row */}
              {gameType !== 'cs2' && <div className="flex justify-between items-center text-xs">
                <div>
                  <div className="text-gaming-gold font-display font-bold text-xs">REG DEADLINE</div>
                  <div className="text-white font-display text-xs">{formatDate(tournament.registrationDeadline).split(',')[0]}</div>
                </div>
                <div className="text-right">
                  <div className="text-gaming-gold font-display font-bold text-xs">STARTS</div>
                  <div className="text-white font-display text-xs">{formatDate(tournament.startDate).split(',')[0]}</div>
                </div>
              </div>}
            </>
          )}

          {/* View Details Button - Glassy Effect */}
          <button
            onClick={() => navigate(`/tournaments/${tournament._id}`)}
            className="w-full py-2 px-3 mt-2 bg-white/10 backdrop-blur-md border border-white/20 hover:border-gaming-gold/60 hover:bg-white/20 text-white font-display font-bold text-xs rounded-lg transition-all duration-300 shadow-lg hover:shadow-gaming-gold/40"
          >
            VIEW DETAILS →
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default TournamentCardProfessional;
