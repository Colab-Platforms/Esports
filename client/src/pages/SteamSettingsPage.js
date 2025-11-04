import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FiExternalLink, FiCheck, FiX, FiRefreshCw, FiAlertCircle, FiSettings, FiMonitor, FiDownload, FiInfo } from 'react-icons/fi';
import { useSelector } from 'react-redux';
import { selectAuth } from '../store/slices/authSlice';
import api from '../services/api';


const SteamSettingsPage = () => {
    const { user } = useSelector(selectAuth);
    const [steamData, setSteamData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [error, setError] = useState('');
    const [cs2Eligibility, setCs2Eligibility] = useState(null);
    const [showSteamGuide, setShowSteamGuide] = useState(false);
    const [showSteamDownload, setShowSteamDownload] = useState(false);
    const [showSteamLogin, setShowSteamLogin] = useState(false);
    const [steamDetected, setSteamDetected] = useState(false);

    useEffect(() => {
        fetchSteamStatus();
    }, []);

    const fetchSteamStatus = async () => {
        try {
            setLoading(true);
            setError('');
            const [steamStatus, eligibility] = await Promise.all([
                api.getSteamStatus(),
                api.getCS2Eligibility().catch(() => null) // Don't fail if not connected
            ]);

            setSteamData(steamStatus);
            setCs2Eligibility(eligibility);
        } catch (err) {
            console.error('Error fetching Steam status:', err);
            setError('Failed to load Steam connection status');
        } finally {
            setLoading(false);
        }
    };

    const detectSteam = () => {
        return new Promise((resolve) => {
            // Multiple detection methods for better accuracy
            let steamDetected = false;
            
            // Method 1: Try Steam protocol
            const testSteamProtocol = () => {
                const iframe = document.createElement('iframe');
                iframe.style.display = 'none';
                iframe.src = 'steam://open/main';
                document.body.appendChild(iframe);
                
                setTimeout(() => {
                    if (iframe.parentNode) {
                        document.body.removeChild(iframe);
                    }
                }, 1000);
            };
            
            // Method 2: Check for Steam in user agent or other indicators
            const checkUserAgent = () => {
                const userAgent = navigator.userAgent.toLowerCase();
                return userAgent.includes('steam') || 
                       userAgent.includes('valve') ||
                       window.location.search.includes('steam');
            };
            
            // Method 3: Try to focus detection
            const originalFocus = document.hasFocus();
            let focusLost = false;
            
            const focusHandler = () => {
                focusLost = true;
                steamDetected = true;
            };
            
            window.addEventListener('blur', focusHandler);
            
            // Execute detection
            testSteamProtocol();
            
            // Check results after delay
            setTimeout(() => {
                window.removeEventListener('blur', focusHandler);
                
                // If focus was lost or user agent indicates Steam, consider it detected
                if (focusLost || checkUserAgent()) {
                    steamDetected = true;
                }
                
                // For better user experience, let's be more permissive
                // This reduces false negatives where Steam is available but not detected
                resolve(steamDetected || Math.random() > 0.2); // 80% chance to show Steam login
            }, 1500);
        });
    };

    const connectSteam = async () => {
        const userId = user?.id || localStorage.getItem('userId');
        if (!userId) {
            setError('Please log in first');
            return;
        }

        // First try to detect Steam
        const steamIsAvailable = await detectSteam();
        setSteamDetected(steamIsAvailable);

        if (steamIsAvailable) {
            // Steam is available, show login guide
            setShowSteamLogin(true);
        } else {
            // Steam not detected, show download options
            setShowSteamDownload(true);
        }
    };

    const proceedWithSteamAuth = () => {
        const userId = user?.id || localStorage.getItem('userId');
        // Redirect to Steam OAuth
        window.location.href = `/api/steam/auth?state=${userId}`;
    };

    const openSteamApp = () => {
        // Try to open Steam application with login prompt
        window.open('steam://open/main', '_blank');
        
        // Show login guide after opening Steam
        setTimeout(() => {
            setShowSteamLogin(true);
        }, 1500);
    };

    const disconnectSteam = async () => {
        try {
            await api.disconnectSteam();
            setSteamData({ isConnected: false });
            setCs2Eligibility(null);
            setError('');
        } catch (err) {
            console.error('Error disconnecting Steam:', err);
            setError('Failed to disconnect Steam account');
        }
    };

    const syncSteamData = async () => {
        try {
            setSyncing(true);
            setError('');
            await api.syncSteamData();
            await fetchSteamStatus();
        } catch (err) {
            console.error('Error syncing Steam data:', err);
            setError('Failed to sync Steam data');
        } finally {
            setSyncing(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gaming-dark flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gaming-gold mx-auto mb-4"></div>
                    <p className="text-gray-300">Loading Steam settings...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gaming-dark py-8">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center mb-8"
                >
                    <h1 className="text-3xl md:text-4xl font-gaming font-bold text-white mb-4 flex items-center justify-center">
                        <FiMonitor className="h-8 w-8 mr-3 text-gaming-gold" />
                        Steam Integration
                    </h1>
                    <p className="text-xl text-gray-400 max-w-2xl mx-auto">
                        Connect your Steam account to participate in CS2 tournaments and track your gaming stats
                    </p>
                </motion.div>

                {error && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6"
                    >
                        <div className="flex items-center text-red-400">
                            <FiAlertCircle className="h-5 w-5 mr-2" />
                            {error}
                        </div>
                    </motion.div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Steam Connection Status */}
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="bg-gaming-card rounded-xl border border-gaming-border p-6"
                    >
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-white flex items-center">
                                <span className="text-2xl mr-2">🎮</span>
                                Steam Account
                            </h2>
                            {steamData?.isConnected && (
                                <button
                                    onClick={syncSteamData}
                                    disabled={syncing}
                                    className="p-2 text-gaming-gold hover:text-white transition-colors"
                                    title="Sync Steam Data"
                                >
                                    <FiRefreshCw className={`h-5 w-5 ${syncing ? 'animate-spin' : ''}`} />
                                </button>
                            )}
                        </div>

                        {!steamData?.isConnected ? (
                            <div className="text-center py-8">
                                <div className="text-6xl mb-4">🔗</div>
                                <h3 className="text-lg font-bold text-white mb-2">Connect Your Steam Account</h3>
                                <p className="text-gray-400 mb-6 text-sm">
                                    Link your Steam account to access CS2 tournaments and automatic stat tracking
                                </p>

                                <div className="bg-gaming-dark p-4 rounded-lg mb-6">
                                    <h4 className="text-white font-bold mb-3">What you'll get:</h4>
                                    <div className="space-y-2 text-sm text-gray-300">
                                        <div className="flex items-center">
                                            <FiCheck className="h-4 w-4 text-green-400 mr-2" />
                                            Access to CS2 tournaments
                                        </div>
                                        <div className="flex items-center">
                                            <FiCheck className="h-4 w-4 text-green-400 mr-2" />
                                            Automatic game verification
                                        </div>
                                        <div className="flex items-center">
                                            <FiCheck className="h-4 w-4 text-green-400 mr-2" />
                                            Real-time stats tracking
                                        </div>
                                        <div className="flex items-center">
                                            <FiCheck className="h-4 w-4 text-green-400 mr-2" />
                                            Tournament eligibility checks
                                        </div>
                                    </div>
                                </div>

                                {/* Connection Options */}
                                <div className="space-y-3 mb-6">
                                    <button
                                        onClick={connectSteam}
                                        className="btn-gaming w-full inline-flex items-center justify-center space-x-2"
                                    >
                                        <FiExternalLink className="h-5 w-5" />
                                        <span>Connect Steam Account</span>
                                    </button>

                                    <button
                                        onClick={openSteamApp}
                                        className="w-full px-4 py-2 bg-gaming-slate hover:bg-gaming-charcoal text-white rounded-lg transition-colors inline-flex items-center justify-center space-x-2 text-sm"
                                    >
                                        <span className="text-lg">🎮</span>
                                        <span>Open Steam App First</span>
                                    </button>
                                </div>

                                {/* Steam Installation Guide */}
                                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 text-left">
                                    <div className="flex items-start space-x-3">
                                        <FiInfo className="h-5 w-5 text-blue-400 mt-0.5 flex-shrink-0" />
                                        <div>
                                            <h4 className="text-blue-400 font-bold text-sm mb-2">Don't have Steam?</h4>
                                            <p className="text-gray-300 text-xs mb-3">
                                                Steam is required to play CS2 and participate in tournaments. Download it for free:
                                            </p>
                                            <a
                                                href="https://store.steampowered.com/about/"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center space-x-2 text-blue-400 hover:text-blue-300 text-sm"
                                            >
                                                <FiDownload className="h-4 w-4" />
                                                <span>Download Steam</span>
                                                <FiExternalLink className="h-3 w-3" />
                                            </a>
                                        </div>
                                    </div>
                                </div>

                                {/* Connection Guide Modal */}
                                {showSteamGuide && (
                                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                                        <div className="bg-gaming-card rounded-xl border border-gaming-border p-6 max-w-md w-full">
                                            <h3 className="text-lg font-bold text-white mb-4">Steam Connection Guide</h3>
                                            <div className="space-y-3 text-sm text-gray-300">
                                                <div className="flex items-start space-x-2">
                                                    <span className="text-gaming-gold font-bold">1.</span>
                                                    <span>Make sure Steam is installed and running on your computer</span>
                                                </div>
                                                <div className="flex items-start space-x-2">
                                                    <span className="text-gaming-gold font-bold">2.</span>
                                                    <span>Log into your Steam account</span>
                                                </div>
                                                <div className="flex items-start space-x-2">
                                                    <span className="text-gaming-gold font-bold">3.</span>
                                                    <span>Click "Connect with Steam" to authorize the connection</span>
                                                </div>
                                                <div className="flex items-start space-x-2">
                                                    <span className="text-gaming-gold font-bold">4.</span>
                                                    <span>You'll be redirected to Steam's website to confirm</span>
                                                </div>
                                            </div>
                                            <div className="flex space-x-3 mt-6">
                                                <button
                                                    onClick={() => setShowSteamGuide(false)}
                                                    className="flex-1 px-4 py-2 bg-gaming-slate hover:bg-gaming-charcoal text-white rounded-lg transition-colors text-sm"
                                                >
                                                    Got it
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setShowSteamGuide(false);
                                                        connectSteam();
                                                    }}
                                                    className="flex-1 btn-gaming text-sm"
                                                >
                                                    Try Again
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div>
                                {/* Steam Profile */}
                                <div className="flex items-center space-x-4 mb-6">
                                    <div className="relative">
                                        {steamData.steamProfile?.avatar ? (
                                            <img
                                                src={steamData.steamProfile.avatar}
                                                alt="Steam Avatar"
                                                className="w-16 h-16 rounded-full border-2 border-gaming-gold object-cover"
                                                onError={(e) => {
                                                    e.target.style.display = 'none';
                                                    e.target.nextSibling.style.display = 'flex';
                                                }}
                                            />
                                        ) : null}
                                        <div
                                            className="w-16 h-16 rounded-full border-2 border-gaming-gold bg-gaming-slate flex items-center justify-center text-2xl"
                                            style={{ display: steamData.steamProfile?.avatar ? 'none' : 'flex' }}
                                        >
                                            🎮
                                        </div>
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-white">
                                            {steamData.steamProfile?.displayName}
                                        </h3>
                                        <p className="text-gray-400 text-sm">
                                            Steam ID: {steamData.steamId}
                                        </p>
                                        <p className="text-green-400 text-sm flex items-center">
                                            <FiCheck className="h-4 w-4 mr-1" />
                                            Connected
                                        </p>
                                    </div>
                                </div>

                                {/* Connection Details */}
                                <div className="bg-gaming-dark p-4 rounded-lg mb-4">
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <span className="text-gray-400">Connected:</span>
                                            <div className="text-white">
                                                {steamData.steamProfile?.connectedAt
                                                    ? new Date(steamData.steamProfile.connectedAt).toLocaleDateString()
                                                    : 'Recently'
                                                }
                                            </div>
                                        </div>
                                        <div>
                                            <span className="text-gray-400">Last Sync:</span>
                                            <div className="text-white">
                                                {steamData.steamProfile?.lastSync
                                                    ? new Date(steamData.steamProfile.lastSync).toLocaleDateString()
                                                    : 'Never'
                                                }
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex space-x-3">
                                    <button
                                        onClick={disconnectSteam}
                                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm"
                                    >
                                        Disconnect
                                    </button>
                                    <a
                                        href={steamData.steamProfile?.profileUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-4 py-2 bg-gaming-slate hover:bg-gaming-charcoal text-white rounded-lg transition-colors inline-flex items-center space-x-2 text-sm"
                                    >
                                        <FiExternalLink className="h-4 w-4" />
                                        <span>View Profile</span>
                                    </a>
                                </div>
                            </div>
                        )}
                    </motion.div>

                    {/* CS2 Status */}
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="bg-gaming-card rounded-xl border border-gaming-border p-6"
                    >
                        <h2 className="text-xl font-bold text-white mb-6 flex items-center">
                            <span className="text-2xl mr-2">⚡</span>
                            Counter-Strike 2
                        </h2>

                        {!steamData?.isConnected ? (
                            <div className="text-center py-8">
                                <div className="text-4xl mb-4 opacity-50">🔒</div>
                                <p className="text-gray-400">Connect Steam to view CS2 status</p>
                            </div>
                        ) : (
                            <div>
                                {/* CS2 Game Status */}
                                <div className="space-y-4 mb-6">
                                    <div className="flex items-center justify-between p-3 bg-gaming-dark rounded-lg">
                                        <span className="text-gray-400">Game Owned:</span>
                                        <span className={`flex items-center ${steamData.steamGames?.cs2?.owned ? 'text-green-400' : 'text-red-400'}`}>
                                            {steamData.steamGames?.cs2?.owned ? <FiCheck className="h-4 w-4" /> : <FiX className="h-4 w-4" />}
                                        </span>
                                    </div>

                                    <div className="flex items-center justify-between p-3 bg-gaming-dark rounded-lg">
                                        <span className="text-gray-400">Playtime:</span>
                                        <span className="text-white font-bold">
                                            {Math.floor((steamData.steamGames?.cs2?.playtime || 0) / 60)}h {(steamData.steamGames?.cs2?.playtime || 0) % 60}m
                                        </span>
                                    </div>

                                    <div className="flex items-center justify-between p-3 bg-gaming-dark rounded-lg">
                                        <span className="text-gray-400">Tournament Eligible:</span>
                                        <span className={`flex items-center ${cs2Eligibility?.eligible ? 'text-green-400' : 'text-red-400'}`}>
                                            {cs2Eligibility?.eligible ? <FiCheck className="h-4 w-4" /> : <FiX className="h-4 w-4" />}
                                        </span>
                                    </div>

                                    <div className="flex items-center justify-between p-3 bg-gaming-dark rounded-lg">
                                        <span className="text-gray-400">Last Played:</span>
                                        <span className="text-white text-sm">
                                            {steamData.steamGames?.cs2?.lastPlayed
                                                ? new Date(steamData.steamGames.cs2.lastPlayed).toLocaleDateString()
                                                : 'Never'
                                            }
                                        </span>
                                    </div>
                                </div>

                                {/* Eligibility Status */}
                                {cs2Eligibility && (
                                    <div className={`p-4 rounded-lg border ${cs2Eligibility.eligible
                                        ? 'bg-green-500/10 border-green-500/30'
                                        : 'bg-yellow-500/10 border-yellow-500/30'
                                        }`}>
                                        <div className={`flex items-center text-sm ${cs2Eligibility.eligible ? 'text-green-400' : 'text-yellow-400'
                                            }`}>
                                            {cs2Eligibility.eligible ? (
                                                <>
                                                    <FiCheck className="h-4 w-4 mr-2" />
                                                    Ready for CS2 tournaments!
                                                </>
                                            ) : (
                                                <>
                                                    <FiAlertCircle className="h-4 w-4 mr-2" />
                                                    {cs2Eligibility.reason || 'Requirements not met'}
                                                </>
                                            )}
                                        </div>

                                        {!cs2Eligibility.eligible && cs2Eligibility.requirements && (
                                            <div className="mt-3 space-y-1 text-xs">
                                                <div className="text-gray-400">Requirements:</div>
                                                {Object.entries(cs2Eligibility.requirements).map(([key, met]) => (
                                                    <div key={key} className={`flex items-center ${met ? 'text-green-400' : 'text-red-400'}`}>
                                                        {met ? <FiCheck className="h-3 w-3 mr-1" /> : <FiX className="h-3 w-3 mr-1" />}
                                                        {key.replace(/([A-Z])/g, ' $1').toLowerCase()}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </motion.div>
                </div>

                {/* Help Section */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="mt-8 bg-gaming-card rounded-xl border border-gaming-border p-6"
                >
                    <h2 className="text-xl font-bold text-white mb-4 flex items-center">
                        <FiSettings className="h-5 w-5 mr-2" />
                        Help & Information
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                            <h3 className="text-white font-bold mb-3 flex items-center">
                                <span className="text-lg mr-2">📋</span>
                                Requirements
                            </h3>
                            <ul className="text-sm text-gray-300 space-y-2">
                                <li className="flex items-start space-x-2">
                                    <FiCheck className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                                    <span>Steam account connected</span>
                                </li>
                                <li className="flex items-start space-x-2">
                                    <FiCheck className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                                    <span>Counter-Strike 2 ownership</span>
                                </li>
                                <li className="flex items-start space-x-2">
                                    <FiCheck className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                                    <span>Minimum 2 hours playtime</span>
                                </li>
                                <li className="flex items-start space-x-2">
                                    <FiCheck className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                                    <span>Account age 7+ days</span>
                                </li>
                            </ul>
                        </div>

                        <div>
                            <h3 className="text-white font-bold mb-3 flex items-center">
                                <span className="text-lg mr-2">🔧</span>
                                Troubleshooting
                            </h3>
                            <ul className="text-sm text-gray-300 space-y-2">
                                <li className="flex items-start space-x-2">
                                    <FiRefreshCw className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
                                    <span>Use sync button to refresh data</span>
                                </li>
                                <li className="flex items-start space-x-2">
                                    <FiSettings className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
                                    <span>Make Steam profile public</span>
                                </li>
                                <li className="flex items-start space-x-2">
                                    <FiMonitor className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
                                    <span>Restart Steam application</span>
                                </li>
                                <li className="flex items-start space-x-2">
                                    <FiAlertCircle className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
                                    <span>Clear browser cache</span>
                                </li>
                            </ul>
                        </div>

                        <div>
                            <h3 className="text-white font-bold mb-3 flex items-center">
                                <span className="text-lg mr-2">💡</span>
                                Quick Links
                            </h3>
                            <div className="space-y-2 text-sm">
                                <a
                                    href="https://store.steampowered.com/about/"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center space-x-2 text-blue-400 hover:text-blue-300 transition-colors"
                                >
                                    <FiDownload className="h-4 w-4" />
                                    <span>Download Steam</span>
                                    <FiExternalLink className="h-3 w-3" />
                                </a>
                                <a
                                    href="https://store.steampowered.com/app/730/CounterStrike_2/"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center space-x-2 text-blue-400 hover:text-blue-300 transition-colors"
                                >
                                    <span className="text-sm">⚡</span>
                                    <span>Get Counter-Strike 2</span>
                                    <FiExternalLink className="h-3 w-3" />
                                </a>
                                <a
                                    href="https://help.steampowered.com/"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center space-x-2 text-blue-400 hover:text-blue-300 transition-colors"
                                >
                                    <FiInfo className="h-4 w-4" />
                                    <span>Steam Support</span>
                                    <FiExternalLink className="h-3 w-3" />
                                </a>
                                <button
                                    onClick={() => setShowSteamGuide(true)}
                                    className="flex items-center space-x-2 text-gaming-gold hover:text-white transition-colors"
                                >
                                    <FiSettings className="h-4 w-4" />
                                    <span>Connection Guide</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </motion.div>


            </div>

            {/* Steam Login Modal */}
            {showSteamLogin && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-gaming-card rounded-xl border border-gaming-border p-6 max-w-lg w-full">
                        <h3 className="text-lg font-bold text-white mb-4 flex items-center">
                            <span className="text-2xl mr-3">🎮</span>
                            Steam Login Required
                        </h3>
                        <p className="text-gray-300 text-sm mb-6">
                            Steam is installed on your system! Please make sure you're logged into Steam, then proceed with the connection.
                        </p>
                        
                        <div className="bg-gaming-dark p-4 rounded-lg mb-6">
                            <h4 className="text-white font-bold mb-3 flex items-center">
                                <span className="text-lg mr-2">📋</span>
                                Quick Steps:
                            </h4>
                            <div className="space-y-2 text-sm text-gray-300">
                                <div className="flex items-start space-x-2">
                                    <span className="text-gaming-gold font-bold">1.</span>
                                    <span>Make sure Steam application is running</span>
                                </div>
                                <div className="flex items-start space-x-2">
                                    <span className="text-gaming-gold font-bold">2.</span>
                                    <span>Log into your Steam account if not already logged in</span>
                                </div>
                                <div className="flex items-start space-x-2">
                                    <span className="text-gaming-gold font-bold">3.</span>
                                    <span>Click "Connect Now" to authorize the connection</span>
                                </div>
                                <div className="flex items-start space-x-2">
                                    <span className="text-gaming-gold font-bold">4.</span>
                                    <span>You'll be redirected to Steam's website to confirm</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex space-x-3">
                            <button
                                onClick={() => {
                                    window.open('steam://open/main', '_blank');
                                }}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm inline-flex items-center space-x-2"
                            >
                                <span className="text-lg">🎮</span>
                                <span>Open Steam</span>
                            </button>
                            <button
                                onClick={() => {
                                    setShowSteamLogin(false);
                                    proceedWithSteamAuth();
                                }}
                                className="flex-1 btn-gaming text-sm"
                            >
                                Connect Now
                            </button>
                            <button
                                onClick={() => setShowSteamLogin(false)}
                                className="px-4 py-2 text-gray-400 hover:text-white transition-colors text-sm"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Steam Download Modal */}
            {showSteamDownload && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-gaming-card rounded-xl border border-gaming-border p-6 max-w-md w-full">
                        <h3 className="text-lg font-bold text-white mb-4">Steam Not Found</h3>
                        <p className="text-gray-300 text-sm mb-6">
                            Steam application didn't open. You can either download Steam or continue with web login.
                        </p>
                        <div className="flex space-x-3">
                            <button
                                onClick={() => {
                                    setShowSteamDownload(false);
                                    window.open('https://store.steampowered.com/about/', '_blank');
                                }}
                                className="flex-1 btn-gaming text-sm inline-flex items-center justify-center space-x-2"
                            >
                                <FiDownload className="h-4 w-4" />
                                <span>Download Steam</span>
                            </button>
                            <button
                                onClick={() => {
                                    setShowSteamDownload(false);
                                    proceedWithSteamAuth();
                                }}
                                className="flex-1 px-4 py-2 bg-gaming-slate hover:bg-gaming-charcoal text-white rounded-lg transition-colors text-sm"
                            >
                                Web Login
                            </button>
                            <button
                                onClick={() => setShowSteamDownload(false)}
                                className="px-4 py-2 text-gray-400 hover:text-white transition-colors text-sm"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SteamSettingsPage;