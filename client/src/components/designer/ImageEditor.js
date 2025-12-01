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

  // Check if user is designer or admin
  const canEdit = user && (user.role === 'designer' || user.role === 'admin');

  if (!canEdit) {
    return null; // Don't show edit button for non-designers
  }

  const handleFileSelect = (e) => {
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

    // Store file for upload
    setSelectedFile(file);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!previewUrl || !selectedFile) return;

    try {
      setUploading(true);
      const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';
      
      // Step 1: Upload image to Cloudinary
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

      if (!uploadResponse.data.success) {
        throw new Error('Failed to upload image');
      }

      const uploadedImageUrl = uploadResponse.data.data.imageUrl;
      
      // Step 2: Update site image record with Cloudinary URL
      const response = await axios.put(
        `${API_URL}/api/site-images/${imageKey}`,
        {
          imageUrl: uploadedImageUrl,
          name: imageKey.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          category: imageKey.includes('banner') ? 'banner' : 
                   imageKey.includes('logo') ? 'logo' : 'other'
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.data.success) {
        onImageUpdate(uploadedImageUrl);
        setIsEditing(false);
        setPreviewUrl('');
        setSelectedFile(null);
        alert('Image updated successfully!');
      }
    } catch (error) {
      console.error('Error updating image:', error);
      alert(error.response?.data?.error?.message || 'Failed to update image');
    } finally {
      setUploading(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setPreviewUrl('');
    setSelectedFile(null);
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
        <div className="bg-black/90 backdrop-blur-sm rounded-lg p-4 min-w-[300px] shadow-xl">
          <h4 className="text-white font-medium mb-3">Edit Image</h4>
          
          {/* File Input */}
          <div className="mb-3">
            <input
              type="file"
              id={`image-${imageKey}`}
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            <label
              htmlFor={`image-${imageKey}`}
              className="flex items-center justify-center space-x-2 w-full p-3 border-2 border-dashed border-gray-600 hover:border-gray-400 rounded-lg cursor-pointer transition-colors"
            >
              <FiUpload className="w-4 h-4 text-gray-400" />
              <span className="text-gray-300 text-sm">
                {previewUrl ? 'Change Image' : 'Select Image'}
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

          {/* Actions */}
          <div className="flex space-x-2">
            <button
              onClick={handleSave}
              disabled={!previewUrl || uploading}
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
