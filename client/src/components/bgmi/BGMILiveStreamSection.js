import { useState, useEffect } from 'react';
import api from '../../services/api';

const BGMILiveStreamSection = () => {
  const [activeTournament, setActiveTournament] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchActiveTournament = async () => {
      try {
        setLoading(true);
        console.log('🔍 BGMILiveStreamSection: Fetching BGMI tournaments...');
        
        // COMMENTED OUT FOR TESTING - Will uncomment later to only fetch active tournaments
        // const response = await api.get('/api/tournaments?status=active&gameType=bgmi&limit=1');
        
        // For testing: Fetch any BGMI tournament (not just active ones)
        // Add timestamp to bypass cache on live server
        const timestamp = new Date().getTime();
        const response = await api.get(`/api/tournaments?gameType=bgmi&limit=1&t=${timestamp}`);
        
        console.log('📦 BGMILiveStreamSection: API Response:', response);
        console.log('📦 BGMILiveStreamSection: Response data:', response.data);
        console.log('📦 BGMILiveStreamSection: Response data.data:', response.data?.data);
        console.log('📦 BGMILiveStreamSection: Response data.data.tournaments:', response.data?.data?.tournaments);
        
        if (response.data && response.data.data && response.data.data.tournaments && response.data.data.tournaments.length > 0) {
          const tournament = response.data.data.tournaments[0];
          console.log('✅ BGMILiveStreamSection: Tournament found:', tournament.name);
          console.log('📝 BGMILiveStreamSection: YouTube Video ID:', tournament.youtubeVideoId);
          setActiveTournament(tournament);
        } else {
          console.log('❌ BGMILiveStreamSection: No tournaments found');
          console.log('📦 Available data:', response.data?.data);
          setActiveTournament(null);
        }
      } catch (error) {
        console.error('❌ BGMILiveStreamSection: Error fetching tournament:', error);
        setActiveTournament(null);
      } finally {
        setLoading(false);
      }
    };

    fetchActiveTournament();

    // Refresh every 30 seconds
    const interval = setInterval(fetchActiveTournament, 30000);

    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="bg-gaming-charcoal/50 rounded-lg overflow-hidden flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gaming-neon"></div>
      </div>
    );
  }

  // Use active tournament video ID or fallback to demo
  const videoId = activeTournament?.youtubeVideoId || 'dQw4w9WgXcQ';
  const tournamentName = activeTournament?.name || 'BGMI Live Stream';
  const isLive = !!activeTournament;

  return (
    <div className="bg-gaming-charcoal/50 rounded-lg overflow-hidden sticky top-20">
      {/* Header */}
      <div className="bg-gaming-dark/80 px-4 py-3 border-b border-gaming-slate">
        <h3 className="text-lg font-bold text-white">
          {isLive ? '🔴 LIVE' : '📺'} {tournamentName}
        </h3>
        {isLive && (
          <p className="text-xs text-gaming-neon mt-1">Tournament is LIVE now!</p>
        )}
      </div>

      {/* Video Container */}
      <div className="relative w-full bg-black">
        <div className="relative w-full pt-[56.25%]">
          <iframe
            className="absolute inset-0 w-full h-full"
            src={`https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&controls=1&modestbranding=1`}
            title={tournamentName}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          ></iframe>
        </div>
      </div>

      {/* Footer Info */}
      <div className="bg-gaming-dark/80 px-4 py-3 border-t border-gaming-slate">
        {isLive ? (
          <div className="space-y-2">
            <p className="text-sm text-gray-300">
              <span className="text-gaming-neon font-semibold">Prize Pool:</span> ₹{activeTournament.prizePool?.toLocaleString() || 'TBA'}
            </p>
            <p className="text-xs text-gray-400">
              {activeTournament.currentParticipants} / {activeTournament.maxParticipants} participants
            </p>
          </div>
        ) : (
          <p className="text-sm text-gray-400">
            No live tournament right now. Check back soon!
          </p>
        )}
      </div>
    </div>
  );
};

export default BGMILiveStreamSection;
