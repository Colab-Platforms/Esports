import { useState } from 'react';
import { useSelector } from 'react-redux';
import { FiCamera, FiUpload, FiCheck, FiX } from 'react-icons/fi';
import { selectAuth } from '../../store/slices/authSlice';
import axios from 'axios';

const ImageEditor = ({ imageKey, currentImageUrl, onImageUpdate, className = '' }) => {
  const { user, token } = useSelector(selectAuth);
  const [isEditing, setIsEditing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadMode, setUploadMode] = useState('single'); // 'single' or 'device'
  const [selectedDevice, setSelectedDevice] = useState('desktop'); // 'desktop', 'tablet', 'mobile'
  const [responsiveFiles, setResponsiveFiles] = useState({
    desktop: null,
    tablet: null,
    mobile: null
  });
  const [responsivePreviews, setResponsivePreviews] = useState({
    desktop: '',
    tablet: '',
    mobile: ''
  });

  // Check if user is designer or admin
  const canEdit = user && (user.role === 'designer' || user.role === 'admin');

  if (!canEdit) {
    return null; // Don't show edit button for non-designers
  }

  const handleFileSelect = (e, device = null) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert('Image size should be less than 10MB');
      return;
    }

    if (device) {
      // Responsive upload
      setResponsiveFiles(prev => ({ ...prev, [device]: file }));
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setResponsivePreviews(prev => ({ ...prev, [device]: reader.result }));
      };
      reader.readAsDataURL(file);
    } else {
      // Single upload
      setSelectedFile(file);

      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    try {
      setUploading(true);
      const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';
      
      let uploadedImageUrl;
      let responsiveUrls = {};

      if (uploadMode === 'single') {
        // Single image upload - Use Base64 for now (Cloudinary optional)
        if (!previewUrl || !selectedFile) return;
        
        // Try Cloudinary first, fallback to Base64
        try {
          const formData = new FormData();
          formData.append('image', selectedFile);
          
          const uploadResponse = await axios.post(
            `${API_URL}/api/upload/image`,
            formData,
            {
              headers: { 
                Authorization: `Bearer ${token}`,
                'Content-Type': 'multipart/form-data'
              }
            }
          );

          if (uploadResponse.data.success) {
            uploadedImageUrl = uploadResponse.data.data.imageUrl;
            console.log('✅ Uploaded to Cloudinary:', uploadedImageUrl);
          }
        } catch (cloudinaryError) {
          console.warn('⚠️ Cloudinary upload failed, using Base64:', cloudinaryError.message);
          // Fallback to Base64
          uploadedImageUrl = previewUrl;
        }
      } else {
        // Device-specific upload
        const device = selectedDevice;
        
        if (responsiveFiles[device]) {
          try {
            const formData = new FormData();
            formData.append('image', responsiveFiles[device]);
            
            const uploadResponse = await axios.post(
              `${API_URL}/api/upload/image`,
              formData,
              {
                headers: { 
                  Authorization: `Bearer ${token}`,
                  'Content-Type': 'multipart/form-data'
                }
              }
            );

            if (uploadResponse.data.success) {
              responsiveUrls[device] = uploadResponse.data.data.imageUrl;
              console.log(`✅ ${device} uploaded to Cloudinary`);
            }
          } catch (cloudinaryError) {
            console.warn(`⚠️ ${device} Cloudinary upload failed, using Base64`);
            // Fallback to Base64
            responsiveUrls[device] = responsivePreviews[device];
          }
        }

        // Use uploaded device URL as main URL
        uploadedImageUrl = responsiveUrls[device];
      }
      
      // Update site image record
      const updateData = {
        imageUrl: uploadedImageUrl,
        name: imageKey.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        category: imageKey.includes('banner') ? 'banner' : 
                 imageKey.includes('logo') ? 'logo' : 'other'
      };

      // Add responsive URLs if in device mode
      if (uploadMode === 'device' && Object.keys(responsiveUrls).length > 0) {
        updateData.responsiveUrls = responsiveUrls;
      }

      console.log('📤 Updating site image:', imageKey, updateData);

      const response = await axios.put(
        `${API_URL}/api/site-images/${imageKey}`,
        updateData,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      console.log('✅ Server response:', response.data);

      if (response.data.success) {
        onImageUpdate(uploadedImageUrl);
        setIsEditing(false);
        setPreviewUrl('');
        setSelectedFile(null);
        setResponsiveFiles({ desktop: null, tablet: null, mobile: null });
        setResponsivePreviews({ desktop: '', tablet: '', mobile: '' });
        alert('✅ Image updated successfully!');
      } else {
        throw new Error(response.data.error?.message || 'Update failed');
      }
    } catch (error) {
      console.error('❌ Error updating image:', error);
      console.error('Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      
      // Show user-friendly error
      const errorMessage = error.response?.data?.error?.message || 
                          error.response?.data?.message ||
                          error.message || 
                          'Failed to update image';
      alert(`❌ ${errorMessage}`);
    } finally {
      setUploading(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setPreviewUrl('');
    setSelectedFile(null);
    setResponsiveFiles({ desktop: null, tablet: null, mobile: null });
    setResponsivePreviews({ desktop: '', tablet: '', mobile: '' });
    setUploadMode('single');
  };

  return (
    <div className={`absolute bottom-4 right-4 z-50 ${className}`}>
      {!isEditing ? (
        <button
          onClick={() => setIsEditing(true)}
          className="p-3 bg-gaming-gold hover:bg-yellow-500 text-black rounded-full backdrop-blur-sm transition-all duration-200 shadow-xl hover:scale-110 border-2 border-black/20"
          title="🎨 Edit Image (Designer Only)"
        >
          <FiCamera className="w-5 h-5" />
        </button>
      ) : (
        <div className="bg-black/90 backdrop-blur-sm rounded-lg p-4 min-w-[350px] max-w-[500px] shadow-xl max-h-[80vh] overflow-y-auto">
          <h4 className="text-white font-medium mb-3">Edit Image</h4>
          
          {/* Upload Mode Toggle */}
          <div className="mb-4 flex space-x-2">
            <button
              onClick={() => setUploadMode('single')}
              className={`flex-1 py-2 px-3 rounded text-sm font-medium transition-colors ${
                uploadMode === 'single'
                  ? 'bg-gaming-gold text-black'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              All Devices
            </button>
            <button
              onClick={() => setUploadMode('device')}
              className={`flex-1 py-2 px-3 rounded text-sm font-medium transition-colors ${
                uploadMode === 'device'
                  ? 'bg-gaming-gold text-black'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Specific Device
            </button>
          </div>

          {/* Device Selection (only for device mode) */}
          {uploadMode === 'device' && (
            <div className="mb-4">
              <label className="text-gray-300 text-xs font-medium mb-2 block">
                Select Device:
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setSelectedDevice('desktop')}
                  className={`py-2 px-3 rounded text-xs font-medium transition-colors ${
                    selectedDevice === 'desktop'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  🖥️ Desktop
                </button>
                <button
                  onClick={() => setSelectedDevice('tablet')}
                  className={`py-2 px-3 rounded text-xs font-medium transition-colors ${
                    selectedDevice === 'tablet'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  📱 Tablet
                </button>
                <button
                  onClick={() => setSelectedDevice('mobile')}
                  className={`py-2 px-3 rounded text-xs font-medium transition-colors ${
                    selectedDevice === 'mobile'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  📱 Mobile
                </button>
              </div>
            </div>
          )}

          {uploadMode === 'single' ? (
            <>
              {/* Single File Input - All Devices */}
              <div className="mb-3">
                <p className="text-gray-400 text-xs mb-2">
                  This image will be used for all devices (Desktop, Tablet, Mobile)
                </p>
                <input
                  type="file"
                  id={`image-${imageKey}`}
                  accept="image/*"
                  onChange={(e) => handleFileSelect(e)}
                  className="hidden"
                />
                <label
                  htmlFor={`image-${imageKey}`}
                  className="flex items-center justify-center space-x-2 w-full p-3 border-2 border-dashed border-gray-600 hover:border-gray-400 rounded-lg cursor-pointer transition-colors"
                >
                  <FiUpload className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-300 text-sm">
                    {previewUrl ? 'Change Image' : 'Select Image (1920x1080)'}
                  </span>
                </label>
              </div>

              {/* Preview */}
              {previewUrl && (
                <div className="mb-3">
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="w-full h-20 object-cover rounded border border-gray-600"
                  />
                </div>
              )}
            </>
          ) : (
            <>
              {/* Device-Specific File Input */}
              <div className="mb-3">
                <p className="text-gray-400 text-xs mb-2">
                  Upload image for <span className="text-gaming-gold font-medium">{selectedDevice}</span> only
                  <br />
                  Recommended: {selectedDevice === 'desktop' ? '1920x1080' : selectedDevice === 'tablet' ? '1024x768' : '750x1334'}
                </p>
                <input
                  type="file"
                  id={`image-${imageKey}-${selectedDevice}`}
                  accept="image/*"
                  onChange={(e) => handleFileSelect(e, selectedDevice)}
                  className="hidden"
                />
                <label
                  htmlFor={`image-${imageKey}-${selectedDevice}`}
                  className="flex items-center justify-center space-x-2 w-full p-3 border-2 border-dashed border-gray-600 hover:border-gray-400 rounded-lg cursor-pointer transition-colors"
                >
                  <FiUpload className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-300 text-sm">
                    {responsivePreviews[selectedDevice] ? 'Change Image' : `Select Image for ${selectedDevice}`}
                  </span>
                </label>
              </div>

              {/* Preview */}
              {responsivePreviews[selectedDevice] && (
                <div className="mb-3">
                  <img
                    src={responsivePreviews[selectedDevice]}
                    alt={`${selectedDevice} preview`}
                    className="w-full h-20 object-cover rounded border border-gray-600"
                  />
                </div>
              )}
            </>
          )}

          {/* Actions */}
          <div className="flex space-x-2">
            <button
              onClick={handleSave}
              disabled={
                uploading || 
                (uploadMode === 'single' && !previewUrl) ||
                (uploadMode === 'device' && !responsivePreviews[selectedDevice])
              }
              className="flex-1 flex items-center justify-center space-x-2 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded text-sm font-medium transition-colors"
            >
              <FiCheck className="w-4 h-4" />
              <span>{uploading ? 'Saving...' : 'Save'}</span>
            </button>
            <button
              onClick={handleCancel}
              disabled={uploading}
              className="flex-1 flex items-center justify-center space-x-2 py-2 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-500 text-white rounded text-sm font-medium transition-colors"
            >
              <FiX className="w-4 h-4" />
              <span>Cancel</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageEditor;
