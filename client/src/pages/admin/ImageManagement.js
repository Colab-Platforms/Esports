import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { FiUpload, FiImage, FiMonitor, FiTablet, FiSmartphone, FiCheck, FiX, FiRefreshCw, FiTrash2 } from 'react-icons/fi';
import { selectAuth } from '../../store/slices/authSlice';
import imageService from '../../services/imageService';
import ResponsiveImage from '../../components/common/ResponsiveImage';

const ImageManagement = () => {
  const { user } = useSelector(selectAuth);
  const [images, setImages] = useState({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [uploadMode, setUploadMode] = useState('single'); // 'single' or 'device'
  const [selectedDevice, setSelectedDevice] = useState('desktop');
  const [previewFile, setPreviewFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');

  // Check if user is designer or admin
  const canManage = user && (user.role === 'designer' || user.role === 'admin');

  useEffect(() => {
    if (canManage) {
      fetchImages();
    }
  }, [canManage]);

  const fetchImages = async () => {
    setLoading(true);
    console.log('🔄 Fetching images...');
    const result = await imageService.getAllImages();
    if (result.success) {
      console.log('✅ Images fetched:', result.data);
      setImages(result.data);
    } else {
      console.error('❌ Failed to fetch images:', result.error);
    }
    setLoading(false);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert('Image size should be less than 10MB');
      return;
    }

    setPreviewFile(file);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!selectedImage || !previewFile) {
      alert('Please select an image and file');
      return;
    }

    setUploading(true);

    try {
      const existingData = images[selectedImage] || {};
      
      const result = await imageService.uploadAndUpdate(
        selectedImage,
        previewFile,
        uploadMode === 'device' ? selectedDevice : null,
        existingData
      );

      if (result.success) {
        const imageName = imageKeys.find(img => img.key === selectedImage)?.name;
        const imageLocation = imageKeys.find(img => img.key === selectedImage)?.location;
        
        const message = uploadMode === 'device'
          ? `✅ ${selectedDevice.charAt(0).toUpperCase() + selectedDevice.slice(1)} image updated!\n\n📍 ${imageName}\n📌 ${imageLocation}`
          : `✅ Image updated successfully!\n\n📍 ${imageName}\n📌 ${imageLocation}`;
        
        // Force refresh images with a small delay to ensure DB is updated
        setTimeout(async () => {
          await fetchImages();
          console.log('🔄 Images refreshed after upload');
        }, 500);
        
        // Reset form
        setPreviewFile(null);
        setPreviewUrl('');
        setSelectedImage(null);
        
        // Show success with option to view
        const viewHomepage = window.confirm(
          `${message}\n\n✅ Upload successful!\n\n🏠 Would you like to view the homepage to see your changes?\n(Homepage will open in a new tab)`
        );
        
        if (viewHomepage) {
          window.open('/', '_blank');
        }
      } else {
        alert(`❌ ${result.error}`);
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('❌ Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const handleCancel = () => {
    setPreviewFile(null);
    setPreviewUrl('');
    setSelectedImage(null);
    setUploadMode('single');
  };

  const handleDeleteDevice = async (imageKey, device) => {
    const confirmDelete = window.confirm(
      `Are you sure you want to delete the ${device} image for ${imageKey}?\n\nThis will remove only the ${device}-specific image. The main image will remain.`
    );

    if (!confirmDelete) return;

    setUploading(true);
    try {
      console.log('🗑️ Deleting device image:', device, 'from', imageKey);

      // Use DELETE method
      const result = await imageService.deleteDeviceImage(imageKey, device);

      if (result.success) {
        alert(`✅ ${device.charAt(0).toUpperCase() + device.slice(1)} image deleted successfully!`);
        await fetchImages();
      } else {
        alert(`❌ ${result.error}`);
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert('❌ Failed to delete image');
    } finally {
      setUploading(false);
    }
  };

  if (!canManage) {
    return (
      <div className="min-h-screen bg-gaming-dark flex items-center justify-center">
        <div className="text-center">
          <FiImage className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Access Denied</h2>
          <p className="text-gray-400">Designer or Admin access required</p>
        </div>
      </div>
    );
  }

  const imageKeys = [
    // Homepage Slides (Auto-rotating every 5 seconds)
    { 
      key: 'homepage-slide-1', 
      name: 'Homepage Slide 1', 
      location: 'Homepage - Hero Slider (Slide 1)',
      recommended: '1920x1080',
      description: 'First slide in homepage hero section - Auto-rotates every 5 seconds',
      category: 'homepage'
    },
    { 
      key: 'homepage-slide-2', 
      name: 'Homepage Slide 2', 
      location: 'Homepage - Hero Slider (Slide 2)',
      recommended: '1920x1080',
      description: 'Second slide in homepage hero section - Auto-rotates every 5 seconds',
      category: 'homepage'
    },
    { 
      key: 'homepage-slide-3', 
      name: 'Homepage Slide 3', 
      location: 'Homepage - Hero Slider (Slide 3)',
      recommended: '1920x1080',
      description: 'Third slide in homepage hero section - Auto-rotates every 5 seconds',
      category: 'homepage'
    },
    { 
      key: 'homepage-slide-4', 
      name: 'Homepage Slide 4', 
      location: 'Homepage - Hero Slider (Slide 4)',
      recommended: '1920x1080',
      description: 'Fourth slide in homepage hero section - Auto-rotates every 5 seconds',
      category: 'homepage'
    },
    { 
      key: 'homepage-slide-5', 
      name: 'Homepage Slide 5', 
      location: 'Homepage - Hero Slider (Slide 5)',
      recommended: '1920x1080',
      description: 'Fifth slide in homepage hero section - Auto-rotates every 5 seconds',
      category: 'homepage'
    },
    
    // BGMI Page Slides
    { 
      key: 'bgmi-slide-1', 
      name: 'BGMI Page Slide 1', 
      location: 'BGMI Page - Banner Slider (Slide 1)',
      recommended: '1920x400',
      description: 'First banner on BGMI tournaments page',
      category: 'bgmi'
    },
    { 
      key: 'bgmi-slide-2', 
      name: 'BGMI Page Slide 2', 
      location: 'BGMI Page - Banner Slider (Slide 2)',
      recommended: '1920x400',
      description: 'Second banner on BGMI tournaments page',
      category: 'bgmi'
    },
    { 
      key: 'bgmi-slide-3', 
      name: 'BGMI Page Slide 3', 
      location: 'BGMI Page - Banner Slider (Slide 3)',
      recommended: '1920x400',
      description: 'Third banner on BGMI tournaments page',
      category: 'bgmi'
    },
    
    // Games Page Slides
    { 
      key: 'games-slide-1', 
      name: 'Games Page Slide 1', 
      location: 'Games Page - Hero Slider (Slide 1)',
      recommended: '1920x1080',
      description: 'First slide on games page',
      category: 'games'
    },
    { 
      key: 'games-slide-2', 
      name: 'Games Page Slide 2', 
      location: 'Games Page - Hero Slider (Slide 2)',
      recommended: '1920x1080',
      description: 'Second slide on games page',
      category: 'games'
    },
    { 
      key: 'games-slide-3', 
      name: 'Games Page Slide 3', 
      location: 'Games Page - Hero Slider (Slide 3)',
      recommended: '1920x1080',
      description: 'Third slide on games page',
      category: 'games'
    },
    
    // Tournament Page Slides
    { 
      key: 'tournaments-slide-1', 
      name: 'Tournaments Page Slide 1', 
      location: 'Tournaments Page - Hero Slider (Slide 1)',
      recommended: '1920x1080',
      description: 'First slide on tournaments page',
      category: 'tournaments'
    },
    { 
      key: 'tournaments-slide-2', 
      name: 'Tournaments Page Slide 2', 
      location: 'Tournaments Page - Hero Slider (Slide 2)',
      recommended: '1920x1080',
      description: 'Second slide on tournaments page',
      category: 'tournaments'
    },
    { 
      key: 'tournaments-slide-3', 
      name: 'Tournaments Page Slide 3', 
      location: 'Tournaments Page - Hero Slider (Slide 3)',
      recommended: '1920x1080',
      description: 'Third slide on tournaments page',
      category: 'tournaments'
    },
    
    // Logo
    { 
      key: 'logo-main', 
      name: 'Main Logo', 
      location: 'Navbar - Top Left',
      recommended: '200x60',
      description: 'Site logo shown in navigation bar on all pages',
      category: 'logo'
    }
  ];

  return (
    <div className="min-h-screen bg-gaming-dark py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-gaming font-bold text-white mb-2">
            🎨 Image Management
          </h1>
          <p className="text-gray-400 mb-3">
            Upload and manage site images for different devices
          </p>
          <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg p-4">
            <p className="text-sm text-blue-300 flex items-start">
              <span className="mr-2">💡</span>
              <span>
                <strong>Tip:</strong> After uploading, click "View on Homepage" button or refresh the homepage to see your changes. 
                Images are cached for performance, so you may need to hard refresh (Ctrl+Shift+R or Cmd+Shift+R).
              </span>
            </p>
          </div>
        </div>

        {/* Upload Section */}
        <div className="bg-gaming-card rounded-lg p-6 mb-8 border border-gray-800">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center">
            <FiUpload className="mr-2" />
            Upload Image
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Form */}
            <div className="space-y-4">
              {/* Select Image Key */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Select Image Location
                </label>
                <select
                  value={selectedImage || ''}
                  onChange={(e) => setSelectedImage(e.target.value)}
                  className="w-full bg-gaming-dark border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-gaming-gold"
                >
                  <option value="">Choose image location...</option>
                  {imageKeys.map(img => (
                    <option key={img.key} value={img.key}>
                      {img.name} - {img.location}
                    </option>
                  ))}
                </select>
                {selectedImage && (
                  <div className="mt-2 p-3 bg-blue-900/20 border border-blue-700/30 rounded-lg">
                    <p className="text-sm text-blue-300">
                      📍 <strong>Location:</strong> {imageKeys.find(img => img.key === selectedImage)?.location}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {imageKeys.find(img => img.key === selectedImage)?.description}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Recommended size: {imageKeys.find(img => img.key === selectedImage)?.recommended}
                    </p>
                  </div>
                )}
              </div>

              {/* Upload Mode */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Upload Mode
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setUploadMode('single')}
                    className={`py-2 px-4 rounded-lg font-medium transition-colors ${
                      uploadMode === 'single'
                        ? 'bg-gaming-gold text-black'
                        : 'bg-gaming-dark border border-gray-700 text-gray-300 hover:border-gray-600'
                    }`}
                  >
                    <FiMonitor className="inline mr-2" />
                    All Devices
                  </button>
                  <button
                    onClick={() => setUploadMode('device')}
                    className={`py-2 px-4 rounded-lg font-medium transition-colors ${
                      uploadMode === 'device'
                        ? 'bg-gaming-gold text-black'
                        : 'bg-gaming-dark border border-gray-700 text-gray-300 hover:border-gray-600'
                    }`}
                  >
                    <FiSmartphone className="inline mr-2" />
                    Specific Device
                  </button>
                </div>
              </div>

              {/* Device Selection */}
              {uploadMode === 'device' && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Select Device
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => setSelectedDevice('desktop')}
                      className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                        selectedDevice === 'desktop'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gaming-dark border border-gray-700 text-gray-300 hover:border-gray-600'
                      }`}
                    >
                      <FiMonitor className="inline mr-1" />
                      Desktop
                    </button>
                    <button
                      onClick={() => setSelectedDevice('tablet')}
                      className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                        selectedDevice === 'tablet'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gaming-dark border border-gray-700 text-gray-300 hover:border-gray-600'
                      }`}
                    >
                      <FiTablet className="inline mr-1" />
                      Tablet
                    </button>
                    <button
                      onClick={() => setSelectedDevice('mobile')}
                      className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                        selectedDevice === 'mobile'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gaming-dark border border-gray-700 text-gray-300 hover:border-gray-600'
                      }`}
                    >
                      <FiSmartphone className="inline mr-1" />
                      Mobile
                    </button>
                  </div>
                </div>
              )}

              {/* File Input */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Select File
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="file-upload"
                  disabled={!selectedImage}
                />
                <label
                  htmlFor="file-upload"
                  className={`flex items-center justify-center w-full p-4 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                    selectedImage
                      ? 'border-gray-600 hover:border-gray-500'
                      : 'border-gray-800 cursor-not-allowed'
                  }`}
                >
                  <FiUpload className="w-5 h-5 text-gray-400 mr-2" />
                  <span className="text-gray-300">
                    {previewFile ? previewFile.name : 'Choose image file'}
                  </span>
                </label>
              </div>

              {/* Actions */}
              <div className="flex space-x-2">
                <button
                  onClick={handleUpload}
                  disabled={uploading || !previewFile || !selectedImage}
                  className="flex-1 flex items-center justify-center space-x-2 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
                >
                  <FiCheck className="w-5 h-5" />
                  <span>{uploading ? 'Uploading...' : 'Upload'}</span>
                </button>
                <button
                  onClick={handleCancel}
                  disabled={uploading}
                  className="flex-1 flex items-center justify-center space-x-2 py-3 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 text-white rounded-lg font-medium transition-colors"
                >
                  <FiX className="w-5 h-5" />
                  <span>Cancel</span>
                </button>
              </div>
            </div>

            {/* Right: Preview */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Preview
              </label>
              <div className="bg-gaming-dark border border-gray-700 rounded-lg p-4 h-64 flex items-center justify-center">
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="max-w-full max-h-full object-contain rounded"
                  />
                ) : (
                  <div className="text-center text-gray-500">
                    <FiImage className="w-12 h-12 mx-auto mb-2" />
                    <p>No image selected</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Current Images */}
        <div className="bg-gaming-card rounded-lg p-6 border border-gray-800">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white flex items-center">
              <FiImage className="mr-2" />
              Current Images
            </h2>
            <button
              onClick={fetchImages}
              disabled={loading}
              className="flex items-center space-x-2 px-4 py-2 bg-gaming-dark hover:bg-gray-800 text-white rounded-lg transition-colors"
            >
              <FiRefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 border-4 border-gaming-gold border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-400">Loading images...</p>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Group by category */}
              {['homepage', 'bgmi', 'games', 'tournaments', 'logo'].map(category => {
                const categoryImages = imageKeys.filter(img => img.category === category);
                if (categoryImages.length === 0) return null;

                const categoryTitles = {
                  homepage: '🏠 Homepage Hero Slider',
                  bgmi: '🎮 BGMI Page Banner',
                  games: '🎮 Games Page Slider',
                  tournaments: '🏆 Tournaments Page Slider',
                  logo: '🎨 Branding'
                };

                return (
                  <div key={category}>
                    <h3 className="text-xl font-bold text-white mb-4 flex items-center">
                      {categoryTitles[category]}
                      <span className="ml-3 text-sm text-gray-500 font-normal">
                        ({categoryImages.filter(img => images[img.key]).length}/{categoryImages.length} uploaded)
                      </span>
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {categoryImages.map(({ key, name, location, recommended, description }) => {
                const image = images[key];
                const hasResponsive = image?.responsiveUrls && Object.keys(image.responsiveUrls).length > 0;

                return (
                  <div key={key} className="bg-gaming-dark rounded-lg p-4 border border-gray-700 hover:border-gray-600 transition-colors">
                    <div className="mb-3">
                      <h3 className="text-white font-medium mb-1">{name}</h3>
                      <p className="text-xs text-blue-400 mb-1">📍 {location}</p>
                      <p className="text-xs text-gray-500">Size: {recommended}</p>
                    </div>
                    
                    <div className="aspect-video bg-black rounded overflow-hidden mb-3 relative group">
                      {image ? (
                        <>
                          {hasResponsive ? (
                            <ResponsiveImage
                              imageUrl={image.imageUrl}
                              responsiveUrls={image.responsiveUrls}
                              alt={name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <img
                              src={image.imageUrl}
                              alt={name}
                              className="w-full h-full object-cover"
                            />
                          )}
                          {/* Hover overlay */}
                          <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <div className="text-center text-white text-xs p-2">
                              <p className="font-medium mb-1">{description}</p>
                              {hasResponsive && (
                                <p className="text-green-400">
                                  ✓ Responsive: {Object.keys(image.responsiveUrls).join(', ')}
                                </p>
                              )}
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-gray-600">
                          <FiImage className="w-8 h-8 mb-2" />
                          <p className="text-xs">No image uploaded</p>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      {/* Device-specific images with delete buttons */}
                      {hasResponsive && (
                        <div className="space-y-2">
                          <div className="text-xs text-green-500 font-medium">
                            ✓ Responsive Images:
                          </div>
                          <div className="space-y-1">
                            {Object.keys(image.responsiveUrls).map(device => (
                              <div key={device} className="flex items-center justify-between bg-gaming-dark/50 rounded px-2 py-1">
                                <span className="text-xs text-gray-400 capitalize flex items-center">
                                  {device === 'desktop' && <FiMonitor className="mr-1" />}
                                  {device === 'tablet' && <FiTablet className="mr-1" />}
                                  {device === 'mobile' && <FiSmartphone className="mr-1" />}
                                  {device}
                                </span>
                                <button
                                  onClick={() => handleDeleteDevice(key, device)}
                                  disabled={uploading}
                                  className="text-red-500 hover:text-red-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                  title={`Delete ${device} image`}
                                >
                                  <FiTrash2 className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {image?.updatedAt && (
                        <div className="text-xs text-gray-500">
                          Updated: {new Date(image.updatedAt).toLocaleDateString()} at {new Date(image.updatedAt).toLocaleTimeString()}
                        </div>
                      )}
                      {!image && (
                        <div className="text-xs text-yellow-500">
                          ⚠️ Upload required
                        </div>
                      )}
                      {image && key.includes('banner') && (
                        <button
                          onClick={() => window.open('/', '_blank')}
                          className="w-full mt-2 py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors flex items-center justify-center space-x-1"
                        >
                          <span>🏠</span>
                          <span>View on Homepage</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImageManagement;
