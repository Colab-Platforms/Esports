import React from 'react';
import { motion } from 'framer-motion';

const TournamentFilters = ({ filters, onFilterChange }) => {
  const gameTypes = [
    { value: 'all', label: 'All Games', icon: '🎮' },
    { value: 'bgmi', label: 'BGMI', icon: '📱' },
    { value: 'valorant', label: 'Valorant', icon: '🎯' },
    { value: 'cs2', label: 'CS2', icon: '⚡' }
  ];

  const statuses = [
    { value: 'all', label: 'All Status' },
    { value: 'registration_open', label: 'Open for Registration' },
    { value: 'upcoming', label: 'Upcoming' },
    { value: 'active', label: 'Live' },
    { value: 'completed', label: 'Completed' }
  ];

  const entryFeeRanges = [
    { value: 'all', label: 'Any Entry Fee' },
    { value: 'free', label: 'Free (₹0)' },
    { value: 'low', label: 'Low (₹1 - ₹500)' },
    { value: 'medium', label: 'Medium (₹501 - ₹2000)' },
    { value: 'high', label: 'High (₹2000+)' }
  ];

  const prizePoolRanges = [
    { value: 'all', label: 'Any Prize Pool' },
    { value: 'small', label: 'Small (Up to ₹10K)' },
    { value: 'medium', label: 'Medium (₹10K - ₹50K)' },
    { value: 'large', label: 'Large (₹50K+)' }
  ];

  const handleFilterChange = (filterType, value) => {
    onFilterChange({
      ...filters,
      [filterType]: value
    });
  };

  const FilterSection = ({ title, options, currentValue, filterType }) => (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-white">{title}</h4>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {options.map((option) => (
          <motion.button
            key={option.value}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleFilterChange(filterType, option.value)}
            className={`p-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              currentValue === option.value
                ? 'bg-gaming-neon text-gaming-dark shadow-gaming'
                : 'bg-gaming-slate text-gray-300 hover:bg-gaming-charcoal hover:text-white'
            }`}
          >
            <div className="flex items-center justify-center space-x-1">
              {option.icon && <span>{option.icon}</span>}
              <span className="truncate">{option.label}</span>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-white">Filter Tournaments</h3>
        <button
          onClick={() => onFilterChange({
            gameType: 'all',
            status: 'all',
            entryFee: 'all',
            prizePool: 'all'
          })}
          className="text-gaming-neon hover:text-gaming-neon-blue text-sm font-medium transition-colors duration-200"
        >
          Reset All
        </button>
      </div>

      <FilterSection
        title="Game Type"
        options={gameTypes}
        currentValue={filters.gameType}
        filterType="gameType"
      />

      <FilterSection
        title="Status"
        options={statuses}
        currentValue={filters.status}
        filterType="status"
      />

      <FilterSection
        title="Entry Fee"
        options={entryFeeRanges}
        currentValue={filters.entryFee}
        filterType="entryFee"
      />

      <FilterSection
        title="Prize Pool"
        options={prizePoolRanges}
        currentValue={filters.prizePool}
        filterType="prizePool"
      />

      {/* Active Filters Summary */}
      <div className="pt-4 border-t border-gray-700">
        <div className="flex flex-wrap gap-2">
          {Object.entries(filters).map(([key, value]) => {
            if (value === 'all') return null;
            
            const getFilterLabel = (filterType, filterValue) => {
              const options = {
                gameType: gameTypes,
                status: statuses,
                entryFee: entryFeeRanges,
                prizePool: prizePoolRanges
              };
              
              const option = options[filterType]?.find(opt => opt.value === filterValue);
              return option ? option.label : filterValue;
            };

            return (
              <motion.span
                key={key}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="inline-flex items-center space-x-1 px-3 py-1 bg-gaming-neon/20 text-gaming-neon border border-gaming-neon/30 rounded-full text-xs font-medium"
              >
                <span>{getFilterLabel(key, value)}</span>
                <button
                  onClick={() => handleFilterChange(key, 'all')}
                  className="ml-1 hover:text-white transition-colors duration-200"
                >
                  ×
                </button>
              </motion.span>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default TournamentFilters;