import React from 'react';

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'video', label: 'Videos' },
  { value: 'article', label: 'Articles' },
  { value: 'featured', label: 'Featured' }
];

const ExploreFilterBar = ({ activeType, onChange }) => {
  return (
    <aside className="mb-6 lg:mb-0 lg:sticky lg:top-24">
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide lg:mx-0 lg:flex-col lg:overflow-visible lg:pb-0 lg:px-0">
        {FILTERS.map((filter) => {
          const isActive = activeType === filter.value;
          return (
            <button
              key={filter.value}
              type="button"
              onClick={() => onChange(filter.value)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium border transition-colors lg:w-full lg:text-left ${
                isActive
                  ? 'bg-gaming-gold text-black border-gaming-gold'
                  : 'bg-gaming-card text-gray-300 border-gaming-border hover:border-gray-500'
              }`}
            >
              {filter.label}
            </button>
          );
        })}
      </div>
    </aside>
  );
};

export default ExploreFilterBar;
