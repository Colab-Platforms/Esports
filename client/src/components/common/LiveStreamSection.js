import React, { useState, useEffect, useRef } from 'react';
import FloatingMiniPlayer from './FloatingMiniPlayer';
import '../../styles/liveStream.css';
import api from '../../services/api';

const LiveStreamSection = () => {
  const [showMiniPlayer, setShowMiniPlayer] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [activeTournament, setActiveTournament] = useState(null);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef(null);
  const observerRef = useRef(null);

  // Fetch active tournaments
  useEffect(() => {
    const fetchActiveTournament = async () => {
      try {
        setLoading(true);
        console.log('🔍 Fetching active tournaments...');
        
        // COMMENTED OUT FOR TESTING - Will uncomment later to only fetch active tournaments
        // const response = await api.get('/api/tournaments?status=active&limit=1');
        
        // For testing: Fetch any tournament (not just active ones)
        const response = await api.get('/api/tournaments?limit=1');
        
        console.log('📦 API Response:', response);
        console.log('📦 Response data:', response.data);
        console.log('📦 Response data.data:', response.data?.data);
        
        if (response.data && response.data.data && response.data.data.length > 0) {
          const tournament = response.data.data[0];
          console.log('✅ Active tournament found:', tournament);
          console.log('📝 Tournament name:', tournament.name);
          console.log('📝 Tournament status:', tournament.status);
          console.log('📝 Tournament youtubeVideoId:', tournament.youtubeVideoId);
          
          setActiveTournament(tournament);
          setIsVisible(true);
        } else {
          console.log('❌ No active tournaments found');
          console.log('📦 Response data.data:', response.data?.data);
          setIsVisible(false);
        }
      } catch (error) {
        console.error('❌ Error fetching active tournament:', error);
        console.error('Error message:', error.message);
        setIsVisible(false);
      } finally {
        setLoading(false);
      }
    };

    fetchActiveTournament();

    // Refresh every 30 seconds to check for active tournaments
    const interval = setInterval(fetchActiveTournament, 30000);

    return () => clearInterval(interval);
  }, []);

  // Intersection Observer for detecting when section leaves viewport
  useEffect(() => {
    if (!isVisible) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          // Show mini-player when section is NOT visible
          if (!entry.isIntersecting) {
            setShowMiniPlayer(true);
          } else {
            setShowMiniPlayer(false);
          }
        });
      },
      {
        threshold: 0.1,
        rootMargin: '0px'
      }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
      observerRef.current = observer;
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [isVisible]);

  const handleMiniPlayerClose = () => {
    setShowMiniPlayer(false);
  };

  const handleScrollToFull = () => {
    if (containerRef.current) {
      containerRef.current.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start' 
      });
      setShowMiniPlayer(false);
    }
  };

  // Don't show if loading or no active tournament
  // COMMENTED OUT FOR TESTING - Will uncomment later to only show when status = 'active'
  // if (loading || !isVisible || !activeTournament) {
  //   console.log('🚫 Not showing live stream:', { loading, isVisible, hasTournament: !!activeTournament });
  //   return null;
  // }

  // For testing: Show if loading or no tournament (will show demo video)
  if (loading) {
    return (
      <section className="live-stream-container">
        <div className="live-stream-wrapper">
          <div className="video-container flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gaming-neon"></div>
          </div>
        </div>
      </section>
    );
  }

  // Extract YouTube video ID from tournament (if stored)
  // For now, use the channel's latest live video
  const videoId = activeTournament?.youtubeVideoId || 'dQw4w9WgXcQ';
  
  console.log('🎬 Rendering live stream with videoId:', videoId);

  return (
    <>
      {/* Full-Screen Live Stream Section */}
      <section 
        ref={containerRef}
        className="live-stream-container"
      >
        <div className="live-stream-wrapper">
          {/* Video Container */}
          <div className="video-container">
            <iframe
              src={`https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&controls=1&modestbranding=1`}
              title="Live Tournament Stream"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            ></iframe>
          </div>
        </div>
      </section>

      {/* Floating Mini Player */}
      {showMiniPlayer && (
        <FloatingMiniPlayer
          videoId={videoId}
          onClose={handleMiniPlayerClose}
          onScrollToFull={handleScrollToFull}
        />
      )}
    </>
  );
};

export default LiveStreamSection;
