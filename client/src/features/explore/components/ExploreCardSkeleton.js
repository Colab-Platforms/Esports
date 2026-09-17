import React from 'react';
import { motion } from 'framer-motion';

// Loading placeholder for ExploreContentCard, styled after TournamentSkeleton.js
const ExploreCardSkeleton = () => {
  return (
    <div className="bg-gaming-card rounded-xl overflow-hidden border border-gaming-border">
      <div className="relative aspect-video bg-gradient-to-br from-gray-700 to-gray-800 animate-pulse" />
      <div className="p-4 space-y-3">
        <div className="w-3/4 h-4 bg-gray-700 rounded animate-pulse" />
        <div className="w-full h-3 bg-gray-700 rounded animate-pulse" />
        <div className="w-1/2 h-3 bg-gray-700 rounded animate-pulse" />
      </div>
    </div>
  );
};

const ExploreCardSkeletonGrid = ({ count = 9 }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
        >
          <ExploreCardSkeleton />
        </motion.div>
      ))}
    </div>
  );
};

export default ExploreCardSkeleton;
export { ExploreCardSkeletonGrid };
