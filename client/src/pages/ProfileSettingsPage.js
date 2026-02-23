import { useSelector } from 'react-redux';
import { FiEdit3 } from 'react-icons/fi';
import { selectAuth } from '../store/slices/authSlice';
import UserAvatar from '../components/common/UserAvatar';
import ProfileSettingsForm from '../components/profile/ProfileSettingsForm';

const ProfileSettingsPage = () => {
  const { user } = useSelector(selectAuth);

  const getCountryInfo = (countryCode) => {
    const countries = {
      'IN': { flag: '🇮🇳', name: 'India' },
      'India': { flag: '🇮🇳', name: 'India' },
      'US': { flag: '🇺🇸', name: 'United States' },
      'UK': { flag: '🇬🇧', name: 'United Kingdom' },
      'CA': { flag: '🇨🇦', name: 'Canada' },
      'AU': { flag: '🇦🇺', name: 'Australia' },
      'PK': { flag: '🇵🇰', name: 'Pakistan' },
      'BD': { flag: '🇧🇩', name: 'Bangladesh' },
      'LK': { flag: '🇱🇰', name: 'Sri Lanka' },
      'NP': { flag: '🇳🇵', name: 'Nepal' }
    };
    return countries[countryCode] || { flag: '🌍', name: countryCode || 'Not set' };
  };

  return (
    <div className="min-h-screen bg-gaming-dark py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-gaming font-bold text-white mb-2">
            Profile Settings
          </h1>
          <p className="text-gray-400">
            Manage your account information and preferences
          </p>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Sidebar - User ID Card */}
          <div className="lg:col-span-1">
            <div className="card-gaming p-6">
              {/* Avatar - Circular */}
              <div className="flex flex-col items-center mb-6">
                <div className="relative w-32 h-32 mb-4">
                  <UserAvatar 
                    user={user} 
                    size="3xl"
                  />
                  <div className="absolute bottom-2 right-2 p-2 bg-gaming-gold text-black rounded-full shadow-lg">
                    <FiEdit3 className="w-4 h-4" />
                  </div>
                </div>

                <h3 className="text-xl font-bold text-white mb-1">
                  {user?.username || 'Player'}
                </h3>
                <p className="text-gray-400 text-sm">
                  ID: #{user?._id?.slice(-6) || '000000'}
                </p>
              </div>

              {/* User Info - Vertical List */}
              <div className="space-y-3">
                <div className="border-b border-gaming-border pb-3">
                  <p className="text-gray-400 text-xs mb-1">Email</p>
                  <p className="text-white text-sm">{user?.email || 'Not set'}</p>
                </div>

                <div className="border-b border-gaming-border pb-3">
                  <p className="text-gray-400 text-xs mb-1">Phone</p>
                  <p className="text-white text-sm">{user?.phone || 'Not set'}</p>
                </div>

                <div className="border-b border-gaming-border pb-3">
                  <p className="text-gray-400 text-xs mb-1">Location</p>
                  <p className="text-white text-sm flex items-center space-x-2">
                    <span className="text-xl">{getCountryInfo(user?.country).flag}</span>
                    <span>{getCountryInfo(user?.country).name}</span>
                    {user?.state && <span className="text-gray-400">• {user.state}</span>}
                  </p>
                </div>

                <div className="border-b border-gaming-border pb-3">
                  <p className="text-gray-400 text-xs mb-1">Member Since</p>
                  <p className="text-white text-sm">
                    {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'Nov 2024'}
                  </p>
                </div>

                <div className="border-b border-gaming-border pb-3">
                  <p className="text-gray-400 text-xs mb-1">Level</p>
                  <p className="text-gaming-gold text-sm font-bold">{user?.level || 1}</p>
                </div>

                <div className="border-b border-gaming-border pb-3">
                  <p className="text-gray-400 text-xs mb-1">Rank</p>
                  <p className="text-gaming-neon text-sm font-bold">{user?.currentRank || 'Bronze'}</p>
                </div>

                <div className="pb-3">
                  <p className="text-gray-400 text-xs mb-1">BGMI ID</p>
                  <p className="text-white text-sm">
                    {user?.gameIds?.bgmi?.uid || user?.bgmiUid || (
                      <span className="text-gray-500 italic">Not set</span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Content - Settings Form */}
          <div className="lg:col-span-2">
            <ProfileSettingsForm embedded={false} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileSettingsPage;
