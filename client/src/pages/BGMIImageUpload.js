import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useSelector } from 'react-redux';
import { selectUser } from '../store/slices/authSlice';
import api from '../services/api';

const BGMIImageUpload = () => {
  const { registrationId } = useParams();
  const navigate = useNavigate();
  const user = useSelector(selectUser);
  
  const [registration, setRegistration] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [images, setImages] = useState({
    leader_1: null,
    leader_2: null,
    member1_1: null,
    member1_2: null,
    member2_1: null,
    member2_2: null,
    member3_1: null,
    member3_2: null
  });

  const [uploadedImages, setUploadedImages] = useState([]);

  const imageLabels = {
    leader_1: 'Team Leader - ID Proof',
    leader_2: 'Team Leader - BGMI Screenshot',
    member1_1: 'Member 1 - ID Proof',
    member1_2: 'Member 1 - BGMI Screenshot',
    member2_1: 'Member 2 - ID Proof',
    member2_2: 'Member 2 - BGMI Screenshot',
    member3_1: 'Member 3 - ID Proof',
    member3_2: 'Member 3 - BGMI Screenshot'
  };

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    
    fetchRegistrationDetails();
  }, [registrationId, user, navigate]);

  const fetchRegistrationDetails = async () => {
    try {
      setLoading(true);
      console.log('🔍 Fetching registration details for ID:', registrationId);
      const response = await api.get(`/api/bgmi-registration/${registrationId}/status`);
      
      console.log('📥 Registration status response:', response.data);
      
      if (response.data.success) {
        setRegistration(response.data.data.registration);
        
        // Fetch existing images
        try {
          const imagesResponse = await api.get(`/api/bgmi-images/${registrationId}/images`);
          if (imagesResponse.data.success) {
            setUploadedImages(imagesResponse.data.data.images);
          }
        } catch (imageError) {
          console.log('ℹ️ No existing images found (this is normal for new registrations)');
          setUploadedImages([]);
        }
      } else {
        console.error('❌ Registration not found in response:', response.data);
        setError('Registration not found');
      }
    } catch (error) {
      console.error('❌ Fetch registration error:', error);
      console.error('❌ Error details:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      });
      setError(error.response?.data?.error?.message || 'Failed to load registration details');
    } finally {
      setLoading(false);
    }
  };

  const handleImageSelect = (label, file) => {
    if (file && file.size > 5 * 1024 * 1024) {
      setError('Image size must be less than 5MB');
      return;
    }
    
    setImages(prev => ({
      ...prev,
      [label]: file
    }));
    setError('');
  };

  const handleUploadAll = async () => {
    const selectedImages = Object.values(images).filter(img => img !== null);
    
    if (selectedImages.length === 0) {
      setError('Please select at least one image to upload');
      return;
    }

    setUploading(true);
    setError('');
    setSuccess('');

    try {
      const formData = new FormData();
      const labels = [];

      // Add selected images and their labels
      Object.entries(images).forEach(([label, file]) => {
        if (file) {
          formData.append('images', file);
          labels.push(label);
        }
      });

      formData.append('imageLabels', JSON.stringify(labels));

      console.log('📸 Uploading images:', {
        registrationId,
        imageCount: selectedImages.length,
        labels
      });

      const response = await api.post(`/api/bgmi-images/${registrationId}/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.data.success) {
        setSuccess(`✅ ${selectedImages.length} images uploaded successfully!`);
        
        // Clear selected images
        setImages({
          leader_1: null,
          leader_2: null,
          member1_1: null,
          member1_2: null,
          member2_1: null,
          member2_2: null,
          member3_1: null,
          member3_2: null
        });

        // Refresh uploaded images
        await fetchRegistrationDetails();

        // If all 8 images are uploaded, show completion message
        if (response.data.data.allImagesUploaded) {
          setTimeout(() => {
            setSuccess('🎉 All verification images uploaded! Your registration is now pending admin verification.');
          }, 1000);
        }
      } else {
        setError(response.data.message || 'Upload failed');
      }
    } catch (error) {
      console.error('❌ Upload error:', error);
      setError(error.response?.data?.error?.message || 'Failed to upload images');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteImage = async (imageId) => {
    try {
      const response = await api.delete(`/api/bgmi-images/${registrationId}/image/${imageId}`);
      
      if (response.data.success) {
        setSuccess('Image deleted successfully');
        await fetchRegistrationDetails();
      } else {
        setError('Failed to delete image');
      }
    } catch (error) {
      console.error('❌ Delete image error:', error);
      setError(error.response?.data?.error?.message || 'Failed to delete image');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gaming-dark flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gaming-neon mx-auto mb-4"></div>
          <p className="text-gray-300">Loading registration details...</p>
        </div>
      </div>
    );
  }

  if (!registration) {
    return (
      <div className="min-h-screen bg-gaming-dark flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400 text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-white mb-2">Registration Not Found</h2>
          <p className="text-gray-300 mb-4">{error}</p>
          <button
            onClick={() => navigate('/bgmi')}
            className="btn-primary"
          >
            Back to Tournaments
          </button>
        </div>
      </div>
    );
  }

  const selectedImageCount = Object.values(images).filter(img => img !== null).length;
  const totalUploadedImages = uploadedImages.length;
  const allImagesUploaded = totalUploadedImages === 8;

  return (
    <div className="min-h-screen bg-gaming-dark">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/bgmi')}
            className="text-gaming-neon hover:text-white mb-4 flex items-center space-x-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span>Back to Tournaments</span>
          </button>
          
          <h1 className="text-3xl font-bold text-white mb-2">Upload Verification Images</h1>
          <p className="text-gray-400">
            Team: <span className="text-gaming-neon font-bold">{registration.teamName}</span> • 
            Tournament: <span className="text-white">{registration.tournamentId.name}</span>
          </p>
        </div>

        {/* Status Messages */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-6">
            <div className="flex items-center space-x-2">
              <span className="text-red-400">⚠️</span>
              <span className="text-red-400 font-medium">{error}</span>
            </div>
          </div>
        )}

        {success && (
          <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 mb-6">
            <div className="flex items-center space-x-2">
              <span className="text-green-400">✅</span>
              <span className="text-green-400 font-medium">{success}</span>
            </div>
          </div>
        )}

        {/* Progress */}
        <div className="card-gaming p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">Upload Progress</h2>
            <div className="text-gaming-neon font-bold">
              {totalUploadedImages}/8 Images Uploaded
            </div>
          </div>
          
          <div className="w-full bg-gaming-charcoal rounded-full h-3 mb-4">
            <div
              className="bg-gaming-neon h-3 rounded-full transition-all duration-300"
              style={{ width: `${(totalUploadedImages / 8) * 100}%` }}
            ></div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="text-center">
              <div className="text-2xl font-bold text-gaming-neon">{totalUploadedImages}</div>
              <div className="text-gray-400">Uploaded</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-white">{8 - totalUploadedImages}</div>
              <div className="text-gray-400">Remaining</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-400">{registration.status === 'images_uploaded' ? '✅' : '⏳'}</div>
              <div className="text-gray-400">Status</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-400">{allImagesUploaded ? '🎉' : '📸'}</div>
              <div className="text-gray-400">Ready</div>
            </div>
          </div>
        </div>

        {/* Image Upload Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Upload New Images */}
          <div className="card-gaming p-6">
            <h3 className="text-xl font-bold text-white mb-4">Select Images to Upload</h3>
            <p className="text-gray-400 mb-6">
              Select images for verification. Each player needs 2 images: ID proof and BGMI screenshot.
            </p>

            <div className="space-y-4">
              {Object.entries(imageLabels).map(([key, label]) => (
                <div key={key} className="border border-gaming-slate rounded-lg p-4">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    {label}
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageSelect(key, e.target.files[0])}
                    className="w-full px-3 py-2 bg-gaming-charcoal border border-gray-600 rounded-lg text-white focus:border-gaming-neon focus:outline-none file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-gaming-neon file:text-gaming-dark hover:file:bg-gaming-neon/90"
                  />
                  {images[key] && (
                    <p className="text-sm text-gaming-neon mt-1">
                      Selected: {images[key].name} ({(images[key].size / 1024 / 1024).toFixed(2)} MB)
                    </p>
                  )}
                </div>
              ))}
            </div>

            {selectedImageCount > 0 && (
              <div className="mt-6">
                <button
                  onClick={handleUploadAll}
                  disabled={uploading}
                  className="w-full px-6 py-3 bg-gaming-neon text-gaming-dark font-bold rounded-lg hover:bg-gaming-neon/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploading ? (
                    <div className="flex items-center justify-center space-x-2">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gaming-dark"></div>
                      <span>Uploading {selectedImageCount} images...</span>
                    </div>
                  ) : (
                    `Upload ${selectedImageCount} Selected Images 📸`
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Uploaded Images */}
          <div className="card-gaming p-6">
            <h3 className="text-xl font-bold text-white mb-4">Uploaded Images</h3>
            
            {uploadedImages.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-gray-400 text-4xl mb-4">📸</div>
                <p className="text-gray-400">No images uploaded yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {uploadedImages.map((image) => (
                  <div key={image._id} className="border border-gaming-slate rounded-lg p-4 flex items-center justify-between">
                    <div>
                      <div className="text-white font-medium">
                        {imageLabels[`${image.playerId}_${image.imageNumber}`]}
                      </div>
                      <div className="text-sm text-gray-400">
                        Uploaded: {new Date(image.uploadedAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <a
                        href={image.cloudinaryUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gaming-neon hover:text-white text-sm"
                      >
                        View
                      </a>
                      <button
                        onClick={() => handleDeleteImage(image._id)}
                        className="text-red-400 hover:text-red-300 text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {allImagesUploaded && (
              <div className="mt-6 bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                <div className="text-center">
                  <div className="text-4xl mb-2">🎉</div>
                  <h4 className="text-lg font-bold text-green-400 mb-2">All Images Uploaded!</h4>
                  <p className="text-sm text-gray-300">
                    Your registration is now pending admin verification. You'll receive a WhatsApp message once verified.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Instructions */}
        <div className="card-gaming p-6 mt-8">
          <h3 className="text-lg font-bold text-white mb-4">📋 Image Requirements</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-md font-bold text-gaming-neon mb-2">ID Proof Images</h4>
              <ul className="text-sm text-gray-300 space-y-1">
                <li>• Clear photo of government ID (Aadhaar, PAN, Driving License)</li>
                <li>• All text should be readable</li>
                <li>• No blur or shadows</li>
                <li>• Maximum 5MB per image</li>
              </ul>
            </div>
            <div>
              <h4 className="text-md font-bold text-gaming-neon mb-2">BGMI Screenshots</h4>
              <ul className="text-sm text-gray-300 space-y-1">
                <li>• Screenshot of BGMI profile page</li>
                <li>• Player ID should be clearly visible</li>
                <li>• Recent gameplay statistics visible</li>
                <li>• High quality screenshot preferred</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BGMIImageUpload;