import React from 'react';
import { motion } from 'framer-motion';

const TournamentSkeleton = () => {
  return (
    <div className="bg-gaming-charcoal rounded-xl overflow-hidden border border-gray-700">
      {/* Image Skeleton */}
      <div className="relative h-48 bg-gradient-to-br from-gray-700 to-gray-800 animate-pulse">
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        
        {/* Status Badge Skeleton */}
        <div className="absolute top-3 left-3">
          <div className="w-20 h-6 bg-gray-600 rounded-full animate-pulse" />
        </div>

        {/* Featured Badge Skeleton */}
        <div className="absolute top-3 right-3">
          <div className="w-16 h-6 bg-gray-600 rounded animate-pulse" />
        </div>

        {/* Game Title Skeleton */}
        <div className="absolute bottom-4 left-4">
          <div className="w-24 h-8 bg-gray-600 rounded animate-pulse" />
        </div>

        {/* Game Icon Skeleton */}
        <div className="absolute bottom-4 right-4">
          <div className="w-8 h-8 bg-gray-600 rounded-full animate-pulse" />
        </div>
      </div>

      {/* Content Skeleton */}
      <div className="p-4 space-y-4">
        {/* Tournament Name */}
        <div className="w-3/4 h-4 bg-gray-700 rounded animate-pulse" />

        {/* Tournament Details */}
        <div className="space-y-3">
          <div className="flex justify-between">
            <div className="w-20 h-3 bg-gray-700 rounded animate-pulse" />
            <div className="w-16 h-3 bg-gray-700 rounded animate-pulse" />
          </div>
          
          <div className="flex justify-between">
            <div className="w-16 h-3 bg-gray-700 rounded animate-pulse" />
            <div className="w-12 h-3 bg-gray-700 rounded animate-pulse" />
          </div>
          
          <div className="flex justify-between">
            <div className="w-14 h-3 bg-gray-700 rounded animate-pulse" />
            <div className="w-20 h-3 bg-gray-700 rounded animate-pulse" />
          </div>

          <div className="flex justify-between">
            <div className="w-18 h-3 bg-gray-700 rounded animate-pulse" />
            <div className="w-14 h-3 bg-gray-700 rounded animate-pulse" />
          </div>
        </div>

        {/* Buttons Skeleton */}
        <div className="flex space-x-2 pt-2">
          <div className="flex-1 h-10 bg-gray-700 rounded-lg animate-pulse" />
          <div className="w-16 h-10 bg-gray-700 rounded-lg animate-pulse" />
        </div>
      </div>
    </div>
  );
};

const TournamentSkeletonGrid = ({ count = 6 }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
        >
          <TournamentSkeleton />
        </motion.div>
      ))}
    </div>
  );
};

export default TournamentSkeleton;
export { TournamentSkeletonGrid };