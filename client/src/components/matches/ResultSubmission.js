import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { 
  fetchMatchDetails,
  submitMatchResult,
  uploadScreenshot,
  selectCurrentMatch,
  selectMatchLoading,
  selectMatchError,
  selectUploadProgress,
  clearMatchError,
  setUploadProgress
} from '../../store/slices/matchSlice';

const ResultSubmission = ({ matchId }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const match = useSelector(selectCurrentMatch);
  const loading = useSelector(selectMatchLoading);
  const error = useSelector(selectMatchError);
  const uploadProgress = useSelector(selectUploadProgress);
  
  const [formData, setFormData] = useState({
    kills: '',
    deaths: '',
    assists: '',
    finalPosition: ''
  });
  const [screenshotFile, setScreenshotFile] = useState(null);
  const [screenshotPreview, setScreenshotPreview] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (matchId) {
      dispatch(fetchMatchDetails(matchId));
    }
  }, [dispatch, matchId]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleScreenshotChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Please select a valid image file');
        return;
      }
      
      // Validate file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        alert('File size must be less than 5MB');
        return;
      }
      
      setScreenshotFile(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setScreenshotPreview(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const validateForm = () => {
    const { kills, deaths, assists, finalPosition } = formData;
    
    if (!kills || !deaths || !assists || !finalPosition) {
      alert('Please fill in all required fields');
      return false;
    }
    
    if (parseInt(kills) < 0 || parseInt(deaths) < 0 || parseInt(assists) < 0) {
      alert('Kills, deaths, and assists cannot be negative');
      return false;
    }
    
    if (parseInt(finalPosition) < 1) {
      alert('Final position must be at least 1');
      return false;
    }
    
    if (!screenshotFile) {
      alert('Please upload a screenshot of your results');
      return false;
    }
    
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // First upload screenshot
      if (screenshotFile) {
        await dispatch(uploadScreenshot({ 
          matchId: match._id, 
          screenshotFile 
        })).unwrap();
      }
      
      // Then submit result
      const resultData = {
        kills: parseInt(formData.kills),
        deaths: parseInt(formData.deaths),
        assists: parseInt(formData.assists),
        finalPosition: parseInt(formData.finalPosition)
      };
      
      await dispatch(submitMatchResult({ 
        matchId: match._id, 
        resultData 
      })).unwrap();
      
      // Success - redirect to match details
      alert('Result submitted successfully!');
      navigate(`/matches/${match._id}`);
      
    } catch (error) {
      console.error('Submission error:', error);
      alert('Failed to submit result. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const calculateScore = () => {
    const { kills, deaths, assists, finalPosition } = formData;
    
    if (!kills || !deaths || !assists || !finalPosition) {
      return 0;
    }
    
    const killPoints = parseInt(kills) * 100;
    const assistPoints = parseInt(assists) * 50;
    const deathPenalty = parseInt(deaths) * 20;
    const winBonus = parseInt(finalPosition) === 1 ? 500 : 0;
    
    return killPoints + assistPoints - deathPenalty + winBonus;
  };

  if (loading.matchDetails) {
    return (
      <div className="min-h-screen bg-gaming-dark flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gaming-neon mx-auto mb-4"></div>
          <p className="text-gray-300">Loading match details...</p>
        </div>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="min-h-screen bg-gaming-dark flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-400 text-6xl mb-4">🔍</div>
          <h2 className="text-xl font-bold text-white mb-2">Match Not Found</h2>
          <p className="text-gray-300">The requested match could not be found.</p>
        </div>
      </div>
    );
  }

  if (match.status !== 'active') {
    return (
      <div className="min-h-screen bg-gaming-dark flex items-center justify-center">
        <div className="text-center">
          <div className="text-yellow-400 text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-white mb-2">Match Not Active</h2>
          <p className="text-gray-300 mb-4">
            Results can only be submitted for active matches.
          </p>
          <button
            onClick={() => navigate(`/matches/${match._id}`)}
            className="btn-primary"
          >
            Back to Match
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gaming-dark">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="card-gaming p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white mb-2">
                Submit Match Results
              </h1>
              <p className="text-gray-300">
                {match.tournamentId?.name} - Round {match.roundNumber}, Match #{match.matchNumber}
              </p>
            </div>
            <button
              onClick={() => navigate(`/matches/${match._id}`)}
              className="btn-primary"
            >
              ← Back to Match
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Result Form */}
          <div className="card-gaming p-6">
            <h2 className="text-xl font-bold text-white mb-6">Your Performance</h2>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Stats Input */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Kills *
                  </label>
                  <input
                    type="number"
                    name="kills"
                    value={formData.kills}
                    onChange={handleInputChange}
                    min="0"
                    required
                    className="w-full px-3 py-2 bg-gaming-charcoal border border-gray-600 rounded-lg text-white focus:border-gaming-neon focus:outline-none"
                    placeholder="0"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Deaths *
                  </label>
                  <input
                    type="number"
                    name="deaths"
                    value={formData.deaths}
                    onChange={handleInputChange}
                    min="0"
                    required
                    className="w-full px-3 py-2 bg-gaming-charcoal border border-gray-600 rounded-lg text-white focus:border-gaming-neon focus:outline-none"
                    placeholder="0"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Assists *
                  </label>
                  <input
                    type="number"
                    name="assists"
                    value={formData.assists}
                    onChange={handleInputChange}
                    min="0"
                    required
                    className="w-full px-3 py-2 bg-gaming-charcoal border border-gray-600 rounded-lg text-white focus:border-gaming-neon focus:outline-none"
                    placeholder="0"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Final Position *
                  </label>
                  <input
                    type="number"
                    name="finalPosition"
                    value={formData.finalPosition}
                    onChange={handleInputChange}
                    min="1"
                    required
                    className="w-full px-3 py-2 bg-gaming-charcoal border border-gray-600 rounded-lg text-white focus:border-gaming-neon focus:outline-none"
                    placeholder="1"
                  />
                </div>
              </div>

              {/* Calculated Score */}
              <div className="bg-gaming-charcoal/50 p-4 rounded-lg">
                <div className="text-center">
                  <div className="text-sm text-gray-300 mb-1">Calculated Score</div>
                  <div className="text-3xl font-bold text-gaming-neon">
                    {calculateScore()}
                  </div>
                  <div className="text-xs text-gray-400 mt-2">
                    (Kills × 100) + (Assists × 50) - (Deaths × 20) + Win Bonus
                  </div>
                </div>
              </div>

              {/* Screenshot Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Screenshot * (Max 5MB)
                </label>
                <div className="border-2 border-dashed border-gray-600 rounded-lg p-6 text-center">
                  {screenshotPreview ? (
                    <div className="space-y-4">
                      <img
                        src={screenshotPreview}
                        alt="Screenshot preview"
                        className="max-w-full h-48 object-contain mx-auto rounded"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setScreenshotFile(null);
                          setScreenshotPreview(null);
                        }}
                        className="text-red-400 hover:text-red-300 text-sm"
                      >
                        Remove Screenshot
                      </button>
                    </div>
                  ) : (
                    <div>
                      <div className="text-4xl text-gray-400 mb-2">📷</div>
                      <p className="text-gray-300 mb-2">
                        Click to upload or drag and drop
                      </p>
                      <p className="text-sm text-gray-400">
                        PNG, JPG, GIF up to 5MB
                      </p>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleScreenshotChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                </div>
              </div>

              {/* Upload Progress */}
              {uploadProgress > 0 && uploadProgress < 100 && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-300">Uploading...</span>
                    <span className="text-gaming-neon">{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-gaming-neon h-2 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                </div>
              )}

              {/* Error Display */}
              {(error.submitResult || error.uploadScreenshot) && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                  <div className="text-red-400 text-sm">
                    {error.submitResult?.message || error.uploadScreenshot?.message}
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting || loading.submitResult || loading.uploadScreenshot}
                className="w-full btn-gaming disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Submitting...
                  </span>
                ) : (
                  '📊 Submit Results'
                )}
              </button>
            </form>
          </div>

          {/* Instructions & Tips */}
          <div className="space-y-6">
            {/* Instructions */}
            <div className="card-gaming p-6">
              <h3 className="text-lg font-bold text-white mb-4">Instructions</h3>
              <div className="space-y-3 text-sm text-gray-300">
                <div className="flex items-start space-x-3">
                  <span className="text-gaming-neon font-bold">1.</span>
                  <span>Enter your exact match statistics (kills, deaths, assists)</span>
                </div>
                <div className="flex items-start space-x-3">
                  <span className="text-gaming-neon font-bold">2.</span>
                  <span>Record your final position in the match</span>
                </div>
                <div className="flex items-start space-x-3">
                  <span className="text-gaming-neon font-bold">3.</span>
                  <span>Upload a clear screenshot of your results screen</span>
                </div>
                <div className="flex items-start space-x-3">
                  <span className="text-gaming-neon font-bold">4.</span>
                  <span>Double-check all information before submitting</span>
                </div>
              </div>
            </div>

            {/* Scoring System */}
            <div className="card-gaming p-6">
              <h3 className="text-lg font-bold text-white mb-4">Scoring System</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-300">Per Kill:</span>
                  <span className="text-gaming-neon font-bold">+100 points</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-300">Per Assist:</span>
                  <span className="text-gaming-neon font-bold">+50 points</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-300">Per Death:</span>
                  <span className="text-red-400 font-bold">-20 points</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-300">Winner Bonus:</span>
                  <span className="text-yellow-400 font-bold">+500 points</span>
                </div>
              </div>
            </div>

            {/* Screenshot Tips */}
            <div className="card-gaming p-6">
              <h3 className="text-lg font-bold text-white mb-4">Screenshot Tips</h3>
              <div className="space-y-2 text-sm text-gray-300">
                <div>• Capture the full results screen</div>
                <div>• Ensure all stats are clearly visible</div>
                <div>• Include your username in the screenshot</div>
                <div>• Use good lighting/contrast</div>
                <div>• File size should be under 5MB</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResultSubmission;