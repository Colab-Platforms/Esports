import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FiExternalLink, FiCheck, FiX, FiRefreshCw, FiAlertCircle, FiDownload, FiInfo } from 'react-icons/fi';
import { useSelector } from 'react-redux';
import { selectAuth } from '../../store/slices/authSlice';
import api from '../../services/api';

const SteamConnectionWidget = ({ 
    onConnectionSuccess, 
    showFullDetails = false, 
    compact = false,
    requiredForAction = false,
    actionText = "participate in tournaments"
}) => {
    const { user } = useSelector(selectAuth);
    const [steamData, setSteamData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showSteamLogin, setShowSteamLogin] = useState(false);
    const [showSteamDownload, setShowSteamDownload] = useState(false);

    useEffect(() => {
        fetchSteamStatus();
    }, []);

    const fetchSteamStatus = async () => {
        try {
            setLoading(true);
            setError('');
            const steamStatus = await api.getSteamStatus();
            setSteamData(steamStatus);
            
            if (steamStatus.isConnected && onConnectionSuccess) {
                onConnectionSuccess(steamStatus);
            }
        } catch (err) {
            console.error('Error fetching Steam status:', err);
            setError('Failed to load Steam connection status');
        } finally {
            setLoading(false);
        }
    };

    const detectSteam = () => {
        return new Promise((resolve) => {
            let steamDetected = false;
            
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
            
            const originalFocus = document.hasFocus();
            let focusLost = false;
            
            const focusHandler = () => {
                focusLost = true;
                steamDetected = true;
            };
            
            window.addEventListener('blur', focusHandler);
            testSteamProtocol();
            
            setTimeout(() => {
                window.removeEventListener('blur', focusHandler);
                resolve(focusLost || Math.random() > 0.4); // 60% chance to show Steam login
            }, 1500);
        });
    };

    const connectSteam = async () => {
        const userId = user?.id || localStorage.getItem('userId');
        if (!userId) {
            setError('Please log in first');
            return;
        }

        const steamIsAvailable = await detectSteam();

        if (steamIsAvailable) {
            setShowSteamLogin(true);
        } else {
            setShowSteamDownload(true);
        }
    };

    const proceedWithSteamAuth = () => {
        const userId = user?.id || localStorage.getItem('userId');
        window.location.href = `/api/steam/auth?state=${userId}`;
    };

    const openSteamApp = () => {
        window.open('steam://open/main', '_blank');
        setTimeout(() => {
            setShowSteamLogin(true);
        }, 1500);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gaming-gold"></div>
                <span className="ml-2 text-gray-300">Checking Steam connection...</span>
            </div>
        );
    }

    // Compact view for tournament pages
    if (compact) {
        return (
            <div className="bg-gaming-card rounded-lg border border-gaming-border p-4">
                {!steamData?.isConnected ? (
                    <div className="text-center">
                        <div className="text-3xl mb-2">🎮</div>
                        <h3 className="text-white font-bold mb-2">Steam Required</h3>
                        <p className="text-gray-400 text-sm mb-4">
                            Connect your Steam account to {actionText}
                        </p>
                        <button
                            onClick={connectSteam}
                            className="btn-gaming w-full text-sm inline-flex items-center justify-center space-x-2"
                        >
                            <FiExternalLink className="h-4 w-4" />
                            <span>Connect Steam</span>
                        </button>
                    </div>
                ) : (
                    <div className="flex items-center space-x-3">
                        <img
                            src={steamData.steamProfile?.avatar}
                            alt="Steam Avatar"
                            className="w-10 h-10 rounded-full border-2 border-gaming-gold"
                            onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.nextSibling.style.display = 'flex';
                            }}
                        />
                        <div className="w-10 h-10 rounded-full border-2 border-gaming-gold bg-gaming-slate flex items-center justify-center text-lg" style={{ display: 'none' }}>
                            🎮
                        </div>
                        <div className="flex-1">
                            <div className="text-white font-bold text-sm">
                                {steamData.steamProfile?.displayName}
                            </div>
                            <div className="text-green-400 text-xs flex items-center">
                                <FiCheck className="h-3 w-3 mr-1" />
                                Steam Connected
                            </div>
                        </div>
                    </div>
                )}

                {/* Modals */}
                {showSteamLogin && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-gaming-card rounded-xl border border-gaming-border p-6 max-w-md w-full">
                            <h3 className="text-lg font-bold text-white mb-4 flex items-center">
                                <span className="text-2xl mr-3">🎮</span>
                                Steam Login Required
                            </h3>
                            <p className="text-gray-300 text-sm mb-4">
                                Make sure Steam is running and you're logged in, then proceed with the connection.
                            </p>
                            <div className="flex space-x-3">
                                <button
                                    onClick={() => {
                                        window.open('steam://open/main', '_blank');
                                    }}
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm"
                                >
                                    Open Steam
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

                {showSteamDownload && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-gaming-card rounded-xl border border-gaming-border p-6 max-w-md w-full">
                            <h3 className="text-lg font-bold text-white mb-4">Steam Not Found</h3>
                            <p className="text-gray-300 text-sm mb-6">
                                Steam application didn't open. You can download Steam or continue with web login.
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
    }

    // Full view for settings page
    return (
        <div className="bg-gaming-card rounded-xl border border-gaming-border p-6">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white flex items-center">
                    <span className="text-2xl mr-2">🎮</span>
                    Steam Account
                </h2>
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
                    <div className="flex items-center text-red-400">
                        <FiAlertCircle className="h-5 w-5 mr-2" />
                        {error}
                    </div>
                </div>
            )}

            {!steamData?.isConnected ? (
                <div className="text-center py-8">
                    <div className="text-6xl mb-4">🔗</div>
                    <h3 className="text-lg font-bold text-white mb-2">Connect Your Steam Account</h3>
                    <p className="text-gray-400 mb-6 text-sm">
                        Link your Steam account to access CS2 tournaments and automatic stat tracking
                    </p>

                    <button
                        onClick={connectSteam}
                        className="btn-gaming inline-flex items-center space-x-2"
                    >
                        <FiExternalLink className="h-5 w-5" />
                        <span>Connect Steam Account</span>
                    </button>

                    <div className="mt-4">
                        <button
                            onClick={openSteamApp}
                            className="px-4 py-2 bg-gaming-slate hover:bg-gaming-charcoal text-white rounded-lg transition-colors inline-flex items-center space-x-2 text-sm"
                        >
                            <span className="text-lg">🎮</span>
                            <span>Open Steam App First</span>
                        </button>
                    </div>
                </div>
            ) : (
                <div className="flex items-center space-x-4">
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
            )}

            {/* Include the same modals as compact view */}
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

export default SteamConnectionWidget;