import React from 'react';
import { FiExternalLink, FiPlay, FiFileText, FiShare2, FiBookOpen } from 'react-icons/fi';
import { FaYoutube, FaInstagram } from 'react-icons/fa';
import OptimizedImage from '../../../components/common/OptimizedImage';
import exploreService from '../services/exploreService';

const CONTENT_TYPE_META = {
  video: { icon: FiPlay, cta: 'Watch video' },
  article: { icon: FiFileText, cta: 'Read article' },
  social: { icon: FiShare2, cta: 'View post' },
  resource: { icon: FiBookOpen, cta: 'Open resource' }
};

const PLATFORM_META = {
  youtube: { label: 'YouTube', icon: FaYoutube, badgeClass: 'bg-red-600' },
  instagram: { label: 'Instagram', icon: FaInstagram, badgeClass: 'bg-pink-600' },
  external: { label: 'External', icon: FiExternalLink, badgeClass: 'bg-gaming-slate' }
};

const ExploreContentCard = ({ item, variant = 'default' }) => {
  const typeMeta = CONTENT_TYPE_META[item.contentType] || CONTENT_TYPE_META.resource;
  const platformMeta = PLATFORM_META[item.platform] || PLATFORM_META.external;
  const TypeIcon = typeMeta.icon;
  const PlatformIcon = platformMeta.icon;
  const isFeatured = variant === 'featured';

  const handleClick = () => {
    exploreService.trackExploreClick(item._id);
    window.open(item.url, '_blank', 'noopener,noreferrer');
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`group text-left w-full bg-gaming-card border border-gaming-border rounded-lg overflow-hidden hover:border-gaming-gold transition-colors ${
        isFeatured ? 'sm:col-span-2' : ''
      }`}
    >
      <div className="relative aspect-video overflow-hidden">
        <OptimizedImage
          src={item.thumbnailUrl}
          alt={item.title}
          className="w-full h-full transition-transform duration-300 group-hover:scale-[1.02]"
        />
        <span className={`absolute top-2 left-2 flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-white ${platformMeta.badgeClass}`}>
          <PlatformIcon className="w-3 h-3" />
          {platformMeta.label}
        </span>
        <span className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-white">
          <FiExternalLink className="w-3.5 h-3.5" />
        </span>
      </div>

      <div className="p-4">
        <h3 className={`text-white font-medium line-clamp-2 ${isFeatured ? 'text-lg' : 'text-base'}`}>
          {item.title}
        </h3>
        {item.description && (
          <p className="mt-1 text-sm text-gray-400 line-clamp-2">
            {item.description}
          </p>
        )}
        <div className="mt-3 flex items-center gap-1.5 text-sm font-medium text-gaming-gold">
          <TypeIcon className="w-4 h-4" />
          <span>{typeMeta.cta}</span>
          <FiExternalLink className="w-3.5 h-3.5" />
        </div>
      </div>
    </button>
  );
};

export default ExploreContentCard;
