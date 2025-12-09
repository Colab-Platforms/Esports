import { useState } from 'react';
import { FiUpload, FiCopy, FiCheck, FiImage, FiTrash2 } from 'react-icons/fi';
import axios from 'axios';

const ImageUploadPage = () => {
  const [uploading, setUploading] = useState(false);
  const [uploadedImages, setUploadedImages] = useState([]);
  const [copiedUrl, setCopiedUrl] = useState('');

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setUploading(true);

    try {
      const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';
      const token = localStorage.getItem('token');

      const uploadPromises = files.map(async (file) => {
        const formData = new FormData();
        formData.append('image', file);

        const response = await axios.post(
          `${API_URL}/api/upload/image`,
          formData,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'multipart/form-data'
            }
          }
        );

        if (response.data.success) {
          return {
            name: file.name,
            url: response.data.data.imageUrl,
            size: (file.size / 1024).toFixed(2) + ' KB',
            type: file.type,
            uploadedAt: new Date().toISOString()
          };
        } else {
          throw new Error('Upload failed');
        }
      });

      const results = await Promise.all(uploadPromises);
      setUploadedImages(prev => [...results, ...prev]);
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload images to Cloudinary');
    } finally {
      setUploading(false);
    }
  };

  const copyToClipboard = (url) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(''), 2000);
  };

  const deleteImage = (index) => {
    setUploadedImages(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="min-h-screen bg-gaming-dark py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-gaming font-bold text-white mb-2">
            Image Upload Center
          </h1>
          <p className="text-gray-400">
            Upload images and get shareable URLs for testing
          </p>
        </div>

        {/* Upload Area */}
        <div className="card-gaming p-8 mb-8">
          <div className="border-2 border-dashed border-gaming-border rounded-lg p-12 text-center hover:border-gaming-gold transition-colors">
            <input
              type="file"
              id="image-upload"
              multiple
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
              disabled={uploading}
            />
            <label
              htmlFor="image-upload"
              className="cursor-pointer flex flex-col items-center"
            >
              <FiUpload className="w-16 h-16 text-gaming-gold mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">
                {uploading ? 'Uploading...' : 'Click to upload images'}
              </h3>
              <p className="text-gray-400 mb-4">
                or drag and drop
              </p>
              <p className="text-sm text-gray-500">
                PNG, JPG, GIF up to 10MB
              </p>
            </label>
          </div>
        </div>

        {/* Instructions */}
        <div className="card-gaming p-6 mb-8 bg-gaming-neon/10 border border-gaming-neon/30">
          <h3 className="text-lg font-bold text-gaming-neon mb-3">
            📋 How to Use:
          </h3>
          <ol className="space-y-2 text-gray-300">
            <li>1. Upload your image(s) using the upload area above</li>
            <li>2. Copy the generated URL by clicking the copy button</li>
            <li>3. Share the URL with developers or use it in your designs</li>
            <li>4. Images are stored on Cloudinary (fast CDN delivery)</li>
          </ol>
        </div>

        {/* Uploaded Images */}
        {uploadedImages.length > 0 && (
          <div className="card-gaming p-6">
            <h2 className="text-2xl font-bold text-white mb-6">
              Uploaded Images ({uploadedImages.length})
            </h2>

            <div className="space-y-4">
              {uploadedImages.map((image, index) => (
                <div
                  key={index}
                  className="bg-gaming-charcoal rounded-lg p-4 flex items-start space-x-4"
                >
                  {/* Thumbnail */}
                  <div className="flex-shrink-0">
                    <img
                      src={image.url}
                      alt={image.name}
                      className="w-24 h-24 object-cover rounded-lg border border-gaming-border"
                    />
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="text-white font-medium truncate">
                          {image.name}
                        </h4>
                        <p className="text-gray-400 text-sm">
                          {image.size} • {new Date(image.uploadedAt).toLocaleString()}
                        </p>
                      </div>
                      <button
                        onClick={() => deleteImage(index)}
                        className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
                        title="Delete"
                      >
                        <FiTrash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* URL */}
                    <div className="bg-gaming-dark rounded p-3 mb-2">
                      <p className="text-xs text-gray-500 mb-1">Image URL:</p>
                      <div className="flex items-center space-x-2">
                        <code className="flex-1 text-xs text-gray-300 overflow-x-auto whitespace-nowrap">
                          {image.url.substring(0, 100)}...
                        </code>
                        <button
                          onClick={() => copyToClipboard(image.url)}
                          className={`flex-shrink-0 px-3 py-1 rounded text-sm font-medium transition-colors ${
                            copiedUrl === image.url
                              ? 'bg-green-600 text-white'
                              : 'bg-gaming-gold text-black hover:bg-yellow-500'
                          }`}
                        >
                          {copiedUrl === image.url ? (
                            <>
                              <FiCheck className="inline mr-1" />
                              Copied!
                            </>
                          ) : (
                            <>
                              <FiCopy className="inline mr-1" />
                              Copy URL
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Preview Link */}
                    <a
                      href={image.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gaming-neon text-sm hover:underline inline-flex items-center"
                    >
                      <FiImage className="mr-1" />
                      Open in new tab
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {uploadedImages.length === 0 && (
          <div className="text-center py-12">
            <FiImage className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">
              No images uploaded yet. Upload some images to get started!
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageUploadPage;
