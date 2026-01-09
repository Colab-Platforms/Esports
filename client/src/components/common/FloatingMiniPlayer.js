import React, { useState } from 'react';
import { FiArrowUp, FiX } from 'react-icons/fi';

const FloatingMiniPlayer = ({ 
  videoId, 
  onClose, 
  onScrollToFull
}) => {
  const [isClosing, setIsClosing] = useState(false);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 400); // Match animation duration
  };

  const handleScrollToFull = () => {
    onScrollToFull();
  };

  if (!videoId) return null;

  return (
    <div className={`floating-mini-player ${isClosing ? 'closing' : ''}`}>
      {/* Video Container */}
      <div 
        className="mini-video-container"
        onClick={handleScrollToFull}
        title="Click to view full stream"
      >
        <iframe
          src={`https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&controls=1&modestbranding=1`}
          title="Live Stream"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        ></iframe>
      </div>
    </div>
  );
};

export default FloatingMiniPlayer;
