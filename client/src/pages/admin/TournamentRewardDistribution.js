import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiDollarSign, FiUsers, FiCheck, FiAlertCircle, FiArrowLeft } from 'react-icons/fi';
import api from '../../services/api';

const TournamentRewardDistribution = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [tournament, setTournament] = useState(null);
  const [teams, setTeams] = useState([]);
  const [winners, setWinners] = useState([
    { position: '1st', teamId: '', amount: '' },
    { position: '2nd', teamId: '', amount: '' },
    { position: '3rd', teamId: '', amount: '' },
    { position: '4th', teamId: '', amount: '' },
    { position: '5th', teamId: '', amount: '' }
  ]);
  const [participationReward, setParticipationReward] = useState('10');
  const [loading, setLoading] = useState(true);
  const [distributing, setDistributing] = useState(false);
  const [rewardStatus, setRewardStatus] = useState(null);
  
  // Video upload states
  const [videoFile, setVideoFile] = useState(null);
  const [videoStatus, setVideoStatus] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processing, setProcessing] = useState(false);
  
  useEffect(() => {
    fetchTournamentData();
  }, [id]);
  
  const fetchTournamentData = async () => {
    try {
      setLoading(true);
      
      // Fetch tournament details
      const tournamentRes = await api.get(`/api/tournaments/${id}`);
      console.log('📦 Tournament data:', tournamentRes);
      setTournament(tournamentRes.data);
      
      // Fetch registered teams
      const teamsRes = await api.get(`/api/tournaments/${id}/registered-teams`);
      console.log('👥 Teams data:', teamsRes);
      
      if (teamsRes.success && teamsRes.data) {
        setTeams(teamsRes.data.teams || []);
        console.log(`✅ Loaded ${teamsRes.data.teams?.length || 0} teams`);
      } else {
        console.warn('⚠️ No teams data in response');
        setTeams([]);
      }
      
      // Fetch reward status
      const statusRes = await api.get(`/api/tournaments/${id}/reward-status`);
      console.log('💰 Reward status:', statusRes);
      setRewardStatus(statusRes.data);
      
      // Fetch video status
      const videoRes = await api.get(`/api/tournaments/${id}/video-status`);
      console.log('🎥 Video status:', videoRes);
      setVideoStatus(videoRes.data);
      
    } catch (error) {
      console.error('❌ Error fetching tournament data:', error);
      console.error('Error details:', error.response?.data);
      alert(`Failed to load tournament data: ${error.response?.data?.error || error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  const handleDistributeRewards = async (e) => {
    e.preventDefault();
    
    // Filter out winners that have both teamId and amount
    const validWinners = winners.filter(w => w.teamId && w.amount && parseInt(w.amount) > 0);
    
    if (validWinners.length === 0) {
      alert('Please select at least one winner team with a reward amount');
      return;
    }
    
    // Check for duplicate teams
    const teamIds = validWinners.map(w => w.teamId);
    const uniqueTeamIds = [...new Set(teamIds)];
    if (teamIds.length !== uniqueTeamIds.length) {
      alert('Cannot select the same team for multiple positions');
      return;
    }
    
    const totalWinnerCoins = validWinners.reduce((sum, w) => sum + parseInt(w.amount), 0);
    const participationCoins = parseInt(participationReward) || 0;
    const nonWinnerTeams = teams.length - validWinners.length;
    const totalParticipationCoins = nonWinnerTeams * participationCoins;
    const grandTotal = totalWinnerCoins + totalParticipationCoins;
    
    const confirmMessage = `Are you sure you want to distribute rewards?\n\n` +
      `Winners: ${validWinners.length}\n` +
      `Winner Rewards: ${totalWinnerCoins} coins\n\n` +
      `Participation Teams: ${nonWinnerTeams}\n` +
      `Participation Reward: ${participationCoins} coins each\n` +
      `Total Participation: ${totalParticipationCoins} coins\n\n` +
      `GRAND TOTAL: ${grandTotal} coins`;
    
    if (!window.confirm(confirmMessage)) {
      return;
    }
    
    try {
      setDistributing(true);
      
      const response = await api.post(`/api/tournaments/${id}/distribute-rewards`, {
        winners: validWinners.map(w => ({
          teamId: w.teamId,
          position: w.position,
          amount: parseInt(w.amount)
        })),
        participationReward: participationCoins
      });
      
      if (response.success) {
        alert(`✅ ${response.message}\n\nTotal coins distributed: ${response.data.totalCoinsDistributed}`);
        fetchTournamentData(); // Refresh data
      }
      
    } catch (error) {
      console.error('Error distributing rewards:', error);
      alert(error.response?.data?.error || 'Failed to distribute rewards');
    } finally {
      setDistributing(false);
    }
  };
  
  const handleWinnerChange = (index, field, value) => {
    const newWinners = [...winners];
    newWinners[index][field] = value;
    setWinners(newWinners);
  };
  
  const handleVideoFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      const allowedTypes = ['video/mp4', 'video/mpeg', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska'];
      if (!allowedTypes.includes(file.type)) {
        alert('Invalid file type. Please upload a video file (MP4, MOV, AVI, MKV)');
        return;
      }
      
      // Validate file size (500MB max)
      const maxSize = 500 * 1024 * 1024;
      if (file.size > maxSize) {
        alert('File too large. Maximum size is 500MB');
        return;
      }
      
      setVideoFile(file);
    }
  };
  
  const handleVideoUpload = async () => {
    if (!videoFile) {
      alert('Please select a video file');
      return;
    }
    
    try {
      setUploading(true);
      setUploadProgress(0);
      
      const formData = new FormData();
      formData.append('video', videoFile);
      
      // Don't set Content-Type header - let browser set it with boundary
      const response = await api.post(`/api/tournaments/${id}/upload-video`, formData);
      
      if (response.success) {
        alert('✅ Video uploaded successfully!');
        setVideoFile(null);
        fetchTournamentData(); // Refresh data
      }
      
    } catch (error) {
      console.error('Error uploading video:', error);
      alert(error.message || 'Failed to upload video');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };
  
  const handleVideoDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this video?')) {
      return;
    }
    
    try {
      const response = await api.delete(`/api/tournaments/${id}/delete-video`);
      
      if (response.success) {
        alert('✅ Video deleted successfully');
        fetchTournamentData(); // Refresh data
      }
      
    } catch (error) {
      console.error('Error deleting video:', error);
      alert(error.response?.data?.error || 'Failed to delete video');
    }
  };
  
  const handleProcessVideo = async () => {
    if (!window.confirm('Process this video to extract scoreboard data?\n\nThis may take 30-60 seconds.')) {
      return;
    }
    
    try {
      setProcessing(true);
      
      const response = await api.post(`/api/tournaments/${id}/process-video`);
      
      if (response.success) {
        alert(`✅ ${response.message}\n\nFound ${response.data.totalTeams} teams!`);
        
        // Auto-populate top 5 winners
        if (response.data.teams && response.data.teams.length > 0) {
          const newWinners = [...winners];
          
          response.data.teams.slice(0, 5).forEach((team, index) => {
            // Find matching team in dropdown by name
            const matchingTeam = teams.find(t => 
              t.name.toLowerCase().includes(team.team_name.toLowerCase()) ||
              team.team_name.toLowerCase().includes(t.name.toLowerCase())
            );
            
            if (matchingTeam) {
              newWinners[index].teamId = matchingTeam._id;
              // Suggest reward based on rank (you can customize this)
              const suggestedRewards = [500, 300, 200, 100, 50];
              newWinners[index].amount = suggestedRewards[index].toString();
            }
          });
          
          setWinners(newWinners);
          alert('✅ Top 5 teams auto-populated! Please review and adjust rewards before distributing.');
        }
        
        fetchTournamentData(); // Refresh data
      }
      
    } catch (error) {
      console.error('Error processing video:', error);
      const errorMsg = error.response?.data?.error || 'Failed to process video';
      const details = error.response?.data?.details || '';
      alert(`❌ ${errorMsg}\n\n${details}`);
    } finally {
      setProcessing(false);
    }
  };
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gaming-dark flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gaming-dark py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/admin/tournaments')}
            className="flex items-center space-x-2 text-gaming-gold hover:text-yellow-400 mb-4"
          >
            <FiArrowLeft />
            <span>Back to Tournaments</span>
          </button>
          
          <h1 className="text-3xl font-gaming font-bold text-white mb-2">
            💰 Distribute Tournament Rewards
          </h1>
          <p className="text-gray-400">
            {tournament?.name}
          </p>
        </div>
        
        {/* Video Upload Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card-gaming p-6 mb-8"
        >
          <h2 className="text-2xl font-gaming font-bold text-white mb-4">
            🎥 Tournament Video Upload
          </h2>
          
          {videoStatus?.hasVideo ? (
            <div className="space-y-4">
              <div className="p-4 bg-green-500/10 border border-green-500 rounded-lg">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-green-400 font-semibold mb-2">✅ Video Uploaded</p>
                    <div className="text-sm text-gray-300 space-y-1">
                      <p>File: <span className="text-white">{videoStatus.originalName}</span></p>
                      <p>Size: <span className="text-white">{(videoStatus.fileSize / (1024 * 1024)).toFixed(2)} MB</span></p>
                      <p>Uploaded: <span className="text-white">{new Date(videoStatus.uploadedAt).toLocaleString()}</span></p>
                      {videoStatus.processed && (
                        <>
                          <p className="text-green-400 font-semibold mt-2">
                            ✅ Processed at {new Date(videoStatus.processedAt).toLocaleString()}
                          </p>
                          <p className="text-white">
                            Teams Found: <span className="text-gaming-gold font-bold">{videoStatus.extractedData?.totalTeams || 0}</span>
                          </p>
                        </>
                      )}
                      {!videoStatus.processed && (
                        <p className="text-yellow-400 font-semibold mt-2">
                          ⏳ Ready for processing
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    {!videoStatus.processed && (
                      <button
                        onClick={handleProcessVideo}
                        disabled={processing}
                        className="px-4 py-2 bg-gaming-gold text-gaming-dark font-bold rounded-lg hover:bg-yellow-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {processing ? 'Processing...' : '🔍 Process Video'}
                      </button>
                    )}
                    <button
                      onClick={handleVideoDelete}
                      className="px-4 py-2 bg-red-500/20 border border-red-500 text-red-400 rounded-lg hover:bg-red-500/30 transition-all"
                    >
                      Delete Video
                    </button>
                  </div>
                </div>
              </div>
              
              {/* Show extracted teams if processed */}
              {videoStatus.processed && videoStatus.extractedData?.teams && (
                <div className="p-4 bg-gaming-charcoal rounded-lg border border-gaming-gold/30">
                  <h4 className="text-lg font-bold text-gaming-gold mb-3">
                    📊 Extracted Scoreboard Data
                  </h4>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {videoStatus.extractedData.teams.slice(0, 10).map((team, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 bg-gaming-dark rounded">
                        <div className="flex items-center space-x-3">
                          <span className="text-gaming-gold font-bold w-8">#{team.rank}</span>
                          <span className="text-white">{team.team_name}</span>
                        </div>
                        <div className="flex items-center space-x-4 text-sm">
                          <span className="text-gray-400">{team.kills} kills</span>
                          <span className="text-gaming-gold font-bold">{team.points} pts</span>
                          <span className="text-gray-500 text-xs">{(team.confidence * 100).toFixed(0)}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-gray-400 mb-4">
                Upload the tournament gameplay video to automatically extract scoreboard data and determine winners.
              </p>
              
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <input
                    type="file"
                    accept="video/mp4,video/mpeg,video/quicktime,video/x-msvideo,video/x-matroska"
                    onChange={handleVideoFileChange}
                    disabled={uploading}
                    className="w-full px-4 py-3 bg-gaming-charcoal border border-gaming-border rounded-lg text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-gaming-gold file:text-gaming-dark file:font-semibold hover:file:bg-yellow-400 disabled:opacity-50"
                  />
                  {videoFile && (
                    <p className="text-sm text-gray-400 mt-2">
                      Selected: {videoFile.name} ({(videoFile.size / (1024 * 1024)).toFixed(2)} MB)
                    </p>
                  )}
                </div>
                
                <button
                  onClick={handleVideoUpload}
                  disabled={!videoFile || uploading}
                  className="px-6 py-3 bg-gaming-gold text-gaming-dark font-bold rounded-lg hover:bg-yellow-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploading ? 'Uploading...' : 'Upload Video'}
                </button>
              </div>
              
              {uploading && (
                <div className="flex items-center space-x-3">
                  <div className="w-full bg-gaming-charcoal rounded-full h-2 overflow-hidden">
                    <div className="bg-gaming-gold h-full animate-pulse" style={{ width: '100%' }} />
                  </div>
                  <span className="text-sm text-gray-400">Uploading...</span>
                </div>
              )}
              
              <div className="text-xs text-gray-500 space-y-1">
                <p>• Supported formats: MP4, MOV, AVI, MKV</p>
                <p>• Maximum file size: 500MB</p>
                <p>• Video will be stored locally on the server</p>
              </div>
            </div>
          )}
        </motion.div>
        
        {/* Reward Status */}
        {rewardStatus?.rewardsDistributed && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="card-gaming p-6 mb-8 bg-green-500/10 border-2 border-green-500"
          >
            <div className="flex items-start space-x-4">
              <FiCheck className="text-green-400 w-6 h-6 mt-1" />
              <div className="flex-1">
                <h3 className="text-xl font-bold text-green-400 mb-2">
                  Rewards Already Distributed
                </h3>
                <div className="text-gray-300 space-y-2">
                  <div>
                    <p className="font-semibold text-white mb-1">Winners:</p>
                    {rewardStatus.winners?.map((winner, idx) => (
                      <p key={idx} className="ml-4">
                        {winner.position}: <span className="text-gaming-gold font-semibold">{winner.amount} coins</span>
                      </p>
                    ))}
                  </div>
                  <p>Participation Reward: <span className="text-gaming-gold font-semibold">{rewardStatus.participationReward} coins</span></p>
                  <p>Total Recipients: <span className="text-white">{rewardStatus.recipients?.length || 0}</span></p>
                  <p>Distributed At: <span className="text-white">{new Date(rewardStatus.distributedAt).toLocaleString()}</span></p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
        
        {/* Distribution Form */}
        {!rewardStatus?.rewardsDistributed && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="card-gaming p-8"
          >
            <form onSubmit={handleDistributeRewards} className="space-y-6">
              {/* Winner Positions */}
              <div>
                <h3 className="text-xl font-bold text-white mb-4">
                  🏆 Select Winners
                </h3>
                <div className="space-y-4">
                  {winners.map((winner, index) => (
                    <div key={index} className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gaming-charcoal rounded-lg">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Position
                        </label>
                        <input
                          type="text"
                          value={winner.position}
                          readOnly
                          className="w-full px-4 py-3 bg-gaming-dark border border-gaming-border rounded-lg text-white font-bold"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Team
                        </label>
                        <select
                          value={winner.teamId}
                          onChange={(e) => handleWinnerChange(index, 'teamId', e.target.value)}
                          className="w-full px-4 py-3 bg-gaming-dark border border-gaming-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-gaming-gold"
                        >
                          <option value="">-- Select Team --</option>
                          {teams.map(team => (
                            <option key={team._id} value={team._id}>
                              {team.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Reward (Coins)
                        </label>
                        <input
                          type="number"
                          value={winner.amount}
                          onChange={(e) => handleWinnerChange(index, 'amount', e.target.value)}
                          min="0"
                          className="w-full px-4 py-3 bg-gaming-dark border border-gaming-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-gaming-gold"
                          placeholder="Enter amount"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Participation Reward */}
              <div className="p-4 bg-gaming-charcoal rounded-lg border border-gaming-gold/30">
                <h4 className="text-lg font-bold text-gaming-gold mb-3">
                  🎁 Participation Reward
                </h4>
                <p className="text-sm text-gray-400 mb-3">
                  All teams that didn't win will receive this amount
                </p>
                <div className="flex items-center space-x-4">
                  <label className="text-sm font-medium text-gray-300">
                    Coins per team:
                  </label>
                  <input
                    type="number"
                    value={participationReward}
                    onChange={(e) => setParticipationReward(e.target.value)}
                    min="0"
                    className="flex-1 px-4 py-3 bg-gaming-dark border border-gaming-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-gaming-gold"
                    placeholder="Enter amount (default: 10)"
                  />
                </div>
              </div>
              
              {/* Calculation Preview */}
              {winners.some(w => w.teamId && w.amount) && (
                <div className="p-4 bg-gaming-charcoal rounded-lg border border-gaming-gold/30">
                  <h4 className="text-sm font-semibold text-gaming-gold mb-3">Distribution Preview</h4>
                  <div className="space-y-2 text-sm">
                    {winners.filter(w => w.teamId && w.amount).map((winner, idx) => {
                      const team = teams.find(t => t._id === winner.teamId);
                      return (
                        <div key={idx} className="flex justify-between">
                          <span className="text-gray-400">{winner.position}: {team?.name}</span>
                          <span className="text-gaming-gold font-bold">{winner.amount} coins</span>
                        </div>
                      );
                    })}
                    
                    {participationReward && parseInt(participationReward) > 0 && (
                      <>
                        <div className="border-t border-gaming-border pt-2 mt-2">
                          <div className="flex justify-between">
                            <span className="text-gray-400">Participation ({teams.length - winners.filter(w => w.teamId).length} teams)</span>
                            <span className="text-gaming-gold">{participationReward} coins each</span>
                          </div>
                        </div>
                      </>
                    )}
                    
                    <div className="flex justify-between pt-2 border-t border-gaming-border">
                      <span className="text-gray-400 font-semibold">Total coins:</span>
                      <span className="text-gaming-gold font-bold text-lg">
                        {winners.filter(w => w.teamId && w.amount).reduce((sum, w) => sum + parseInt(w.amount || 0), 0) + 
                         (parseInt(participationReward || 0) * (teams.length - winners.filter(w => w.teamId).length))}
                      </span>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Submit Button */}
              <button
                type="submit"
                disabled={distributing || !winners.some(w => w.teamId && w.amount)}
                className="w-full btn-gaming py-4 text-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {distributing ? 'Distributing...' : '💰 Distribute Rewards'}
              </button>
              
              {teams.length === 0 && (
                <p className="text-yellow-400 text-sm text-center">
                  <FiAlertCircle className="inline mr-1" />
                  No registered teams found for this tournament
                </p>
              )}
            </form>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default TournamentRewardDistribution;
