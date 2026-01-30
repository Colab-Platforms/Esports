import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiSearch, FiFilter, FiCalendar, FiUsers, FiDollarSign, FiClock, FiAward } from 'react-icons/fi';
import GameIcon from '../../components/common/GameIcon';

const TournamentDetailsPage = () => {
  const { gameType } = useParams();
  const [activeTab, setActiveTab] = useState('upcoming');
  const [activeCategory, setActiveCategory] = useState('colab');
  const [searchQuery, setSearchQuery] = useState('');

  // Helper function to get game info
  const getGameInfo = (game) => {
    const games = {
      valorant: {
        name: 'VALORANT',
        bgImage: 'linear-gradient(135deg, #ff4655 0%, #000000 100%)',
        description: 'Tactical FPS tournaments with strategic gameplay'
      },
      bgmi: {
        name: 'BGMI',
        bgImage: 'linear-gradient(135deg, #ff6b35 0%, #000000 100%)',
        description: 'Battle Royale tournaments for mobile champions'
      },
      cs2: {
        name: 'CS2',
        bgImage: 'linear-gradient(135deg, #1e3c72 0%, #000000 100%)',
        description: 'Counter-Strike 2 competitive tournaments'
      },
      freefire: {
        name: 'Free Fire',
        bgImage: 'linear-gradient(135deg, #ff1744 0%, #000000 100%)',
        description: 'Fast-paced battle royale tournaments for mobile gamers'
      }
    };
    return games[game] || games.valorant;
  };

  const gameInfo = getGameInfo(gameType);

  const tabs = [
    { id: 'upcoming', label: 'UPCOMING', count: 5 },
    { id: 'ongoing', label: 'ONGOING', count: 2 },
    { id: 'past', label: 'PAST', count: 15 }
  ];

  const categories = [
    { id: 'colab', label: 'COLAB TOURNAMENTS', count: 8 },
    { id: 'premium', label: 'PREMIUM TOURNAMENTS', count: 3 },
    { id: 'community', label: 'COMMUNITY TOURNAMENTS', count: 11 }
  ];

  // Mock tournaments data
  const tournaments = {
    upcoming: [
      {
        id: 1,
        name: `COLAB ${gameInfo.name} CHAMPIONSHIP`,
        prizePool: '₹50,000',
        entryFee: '₹500',
        participants: '64/100',
        startDate: '2025-10-28',
        category: 'colab'
      },
      {
        id: 2,
        name: `${gameInfo.name} WEEKLY SHOWDOWN`,
        prizePool: '₹25,000',
        entryFee: '₹300',
        participants: '32/80',
        startDate: '2025-10-30',
        category: 'premium'
      }
    ],
    ongoing: [
      {
        id: 3,
        name: `${gameInfo.name} LIVE BATTLE`,
        prizePool: '₹75,000',
        entryFee: '₹750',
        participants: '96/100',
        startDate: '2025-10-25',
        category: 'colab'
      }
    ],
    past: []
  };

  const filteredTournaments = tournaments[activeTab]?.filter(tournament => {
    const matchesSearch = tournament.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory === 'all' || tournament.category === activeCategory;
    return matchesSearch && matchesCategory;
  }) || [];

  return (
    <div className="min-h-screen bg-gaming-dark">
      {/* Hero Section */}
      <section 
        className="relative h-64 flex items-center justify-center overflow-hidden"
        style={{ background: gameInfo.bgImage }}
      >
        <div className="absolute inset-0 bg-black/60" />
        <div className="relative z-10 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-8xl mb-4"
          >
            <GameIcon gameType={gameType} size="2xl" />
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-5xl md:text-7xl font-gaming font-bold text-white mb-4"
          >
            {gameInfo.name}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-xl text-gray-300"
          >
            {gameInfo.description}
          </motion.p>
        </div>
      </section>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Game Title */}
        <div className="mb-8">
          <h2 className="text-2xl font-gaming font-bold text-white mb-2">
            {gameInfo.name.toUpperCase()}:
          </h2>
        </div>

        {/* Search and Filters */}
        <div className="mb-8 flex flex-col md:flex-row gap-4">
          {/* Search Bar */}
          <div className="flex-1 relative">
            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="text"
              placeholder="Type to search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-gaming-card border border-gaming-border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gaming-gold focus:border-transparent"
            />
          </div>

          {/* Filters Button */}
          <button className="flex items-center space-x-2 px-6 py-3 bg-gaming-card border border-gaming-border rounded-lg text-white hover:border-gaming-gold transition-colors duration-200">
            <FiFilter className="h-4 w-4" />
            <span>Filters</span>
          </button>
        </div>

        {/* Date Filter */}
        <div className="mb-6">
          <select className="px-4 py-2 bg-gaming-card border border-gaming-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-gaming-gold">
            <option>CLOSEST START DATE</option>
            <option>LATEST START DATE</option>
            <option>HIGHEST PRIZE POOL</option>
            <option>LOWEST ENTRY FEE</option>
          </select>
        </div>

        {/* Tournament Status Tabs */}
        <div className="mb-8">
          <div className="flex space-x-8 border-b border-gaming-border">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`pb-4 px-2 font-semibold transition-colors duration-200 ${
                  activeTab === tab.id
                    ? 'text-gaming-gold border-b-2 border-gaming-gold'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tournament Categories */}
        <div className="mb-8">
          <div className="flex flex-wrap gap-4">
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setActiveCategory(category.id)}
                className={`px-4 py-2 rounded-lg font-semibold transition-colors duration-200 ${
                  activeCategory === category.id
                    ? 'bg-gaming-gold text-black'
                    : 'bg-gaming-card text-gray-300 hover:text-white border border-gaming-border'
                }`}
              >
                {category.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tournament List */}
        <div className="min-h-96">
          {filteredTournaments.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTournaments.map((tournament, index) => (
                <motion.div
                  key={tournament.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="card-gaming p-6 hover:border-gaming-gold/50 transition-all duration-300"
                >
                  <h3 className="text-lg font-bold text-white mb-4">
                    {tournament.name}
                  </h3>
                  
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Prize Pool:</span>
                      <span className="text-gaming-gold font-bold">{tournament.prizePool}</span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-gray-400">Entry Fee:</span>
                      <span className="text-white">{tournament.entryFee}</span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-gray-400">Players:</span>
                      <span className="text-white">{tournament.participants}</span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-gray-400">Start Date:</span>
                      <span className="text-white">{tournament.startDate}</span>
                    </div>
                  </div>

                  <div className="mt-6 flex space-x-2">
                    <button 
                      onClick={() => {
                        // Navigate to specific tournament detail page based on game type
                        if (gameType === 'bgmi') {
                          window.location.href = `/tournaments/${tournament.id}`;
                        } else {
                          // For other games, show old modal or redirect to login
                          alert('Registration coming soon for this game type!');
                        }
                      }}
                      className="flex-1 btn-gaming py-2 text-sm"
                    >
                      REGISTER NOW
                    </button>
                    <button 
                      onClick={() => {
                        // Navigate to tournament detail page
                        window.location.href = `/tournaments/${tournament.id}`;
                      }}
                      className="px-4 py-2 border border-gaming-border text-gray-300 rounded-lg hover:border-gaming-gold hover:text-gaming-gold transition-colors duration-200 text-sm"
                    >
                      VIEW DETAILS
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            // Empty State (like Lidoma)
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-16"
            >
              <div className="text-6xl text-gray-600 mb-4">
                <FiAward />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">No tournaments</h3>
              <p className="text-gray-400 text-center max-w-md">
                {activeTab === 'upcoming' 
                  ? `No upcoming ${gameInfo.name} tournaments found. Check back later or try different filters.`
                  : activeTab === 'ongoing'
                  ? `No ongoing ${gameInfo.name} tournaments at the moment.`
                  : `No past ${gameInfo.name} tournaments to display.`
                }
              </p>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TournamentDetailsPage;