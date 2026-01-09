import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FiPlay, FiUsers, FiAward, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import api from '../services/api';
import imageService from '../services/imageService';
import GameIcon from '../components/common/GameIcon';

const GamesPage = () => {
    const [currentBanner, setCurrentBanner] = useState(0);
    const [games, setGames] = useState([]);
    const [featuredGames, setFeaturedGames] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [siteImages, setSiteImages] = useState({});
    const [selectedGameFilter, setSelectedGameFilter] = useState('all');

    // Fetch games from database
    useEffect(() => {
        const fetchGames = async () => {
            try {
                setLoading(true);
                const [gamesResponse, featuredData] = await Promise.all([
                    api.getGames(),
                    api.getFeaturedGames()
                ]);

                // Extract games from response structure
                const gamesArray = gamesResponse?.data?.games || gamesResponse?.games || [];
                const featuredArray = featuredData?.data?.games || featuredData || [];

                setGames(gamesArray);
                setFeaturedGames(featuredArray);
                setError(null);
            } catch (err) {
                console.error('Error fetching games:', err);
                setError('Failed to load games. Please try again later.');
            } finally {
                setLoading(false);
            }
        };

        fetchGames();
        fetchSiteImages();
    }, []);

    const fetchSiteImages = async () => {
        const result = await imageService.getAllImages();
        if (result.success) {
            setSiteImages(result.data);
        }
    };

    // Create banners from ImageManagement (games-slide-1, games-slide-2, games-slide-3)
    const banners = [
        {
            id: 1,
            imageKey: 'games-slide-1',
            image: siteImages['games-slide-1']?.imageUrl
        },
        {
            id: 2,
            imageKey: 'games-slide-2',
            image: siteImages['games-slide-2']?.imageUrl
        },
        {
            id: 3,
            imageKey: 'games-slide-3',
            image: siteImages['games-slide-3']?.imageUrl
        }
    ].filter(banner => banner.image); // Only show uploaded banners

    // Reset currentBanner if out of bounds
    useEffect(() => {
        if (banners.length > 0 && currentBanner >= banners.length) {
            setCurrentBanner(0);
        }
    }, [banners.length, currentBanner]);

    // Auto-slide banners
    useEffect(() => {
        if (banners.length === 0) return;
        
        const interval = setInterval(() => {
            setCurrentBanner((prev) => (prev + 1) % banners.length);
        }, 5000);
        return () => clearInterval(interval);
    }, [banners.length]);

    const nextBanner = () => {
        setCurrentBanner((prev) => (prev + 1) % banners.length);
    };

    const prevBanner = () => {
        setCurrentBanner((prev) => (prev - 1 + banners.length) % banners.length);
    };

    // Helper function to map database game names/ids to gameAssets keys
    const getGameType = (game) => {
        const name = game.name?.toLowerCase() || '';
        const id = game.id?.toLowerCase() || '';
        
        // Map common game names to gameAssets keys
        if (name.includes('bgmi') || name.includes('battlegrounds') || id.includes('bgmi')) {
            return 'bgmi';
        }
        if (name.includes('cs2') || name.includes('counter-strike') || id.includes('cs2')) {
            return 'cs2';
        }
        if (name.includes('valorant') || id.includes('valorant')) {
            return 'valorant';
        }
        if (name.includes('free fire') || name.includes('freefire') || id.includes('freefire')) {
            return 'freefire';
        }
        if (name.includes('mobile legends') || name.includes('ml') || id.includes('ml')) {
            return 'ml';
        }
        if (name.includes('apex') || id.includes('apex')) {
            return 'apex';
        }
        if (name.includes('rainbow') || name.includes('siege') || id.includes('rainbow')) {
            return 'rainbow6';
        }
        if (name.includes('fc 24') || name.includes('fifa') || id.includes('fc24')) {
            return 'fc24';
        }
        
        // Default fallback
        return 'bgmi';
    };

    // Filter games based on selected filter
    const filteredGames = selectedGameFilter === 'all' 
        ? games 
        : games.filter(game => getGameType(game) === selectedGameFilter);

    // Get unique game types from database
    const gameTypes = ['all', ...new Set(games.map(game => getGameType(game)))];

    const GameCard = ({ game }) => (
        <Link to={`/game/${game.id}`}>
            <motion.div
                whileHover={{ y: -8, scale: 1.02 }}
                className="relative overflow-hidden rounded-xl border border-gaming-border hover:border-gaming-gold/50 transition-all duration-300 group cursor-pointer"
                style={{ background: game.background }}
            >
                <div className="absolute inset-0 bg-black/60 group-hover:bg-black/40 transition-all duration-300" />

                <div className="relative p-6 h-64 flex flex-col justify-between bg-gradient-to-br from-gaming-charcoal to-gaming-slate border border-gaming-gold/20 hover:border-gaming-gold/50 transition-all duration-300">
                    {/* Game Icon & Category */}
                    <div className="flex justify-between items-start">
                        <div className="flex items-center justify-center">
                            <GameIcon 
                                gameType={getGameType(game)} 
                                size="2xl" 
                                style="cdn"
                            />
                        </div>
                        <span className="px-3 py-1 bg-gaming-gold text-black text-xs font-bold rounded-full">
                            {game.category}
                        </span>
                    </div>

                    {/* Game Info */}
                    <div>
                        <h3 className="text-2xl font-gaming font-bold text-white mb-2 group-hover:text-gaming-gold transition-colors duration-300">
                            {game.name}
                        </h3>
                        <p className="text-gray-300 text-sm mb-4 line-clamp-2">
                            {game.description}
                        </p>

                        {/* Stats */}
                        <div className="grid grid-cols-3 gap-2 text-xs">
                            <div className="text-center">
                                <div className="text-gaming-gold font-bold">{game.tournaments}</div>
                                <div className="text-gray-400">Tournaments</div>
                            </div>
                            <div className="text-center">
                                <div className="text-gaming-gold font-bold">{game.activePlayers}</div>
                                <div className="text-gray-400">Players</div>
                            </div>
                            <div className="text-center">
                                <div className="text-gaming-gold font-bold">{game.totalPrize}</div>
                                <div className="text-gray-400">Prize Pool</div>
                            </div>
                        </div>
                    </div>
                </div>
            </motion.div>
        </Link>
    );

    // Loading state
    if (loading) {
        return (
            <div className="min-h-screen bg-gaming-dark flex items-center justify-center">
                <div className="text-center">
                    {/* Infinity Dots Loader */}
                    <div className="flex justify-center items-center space-x-2 mb-4">
                        <div className="w-3 h-3 bg-gaming-gold rounded-full animate-bounce" style={{animationDelay: '0s'}}></div>
                        <div className="w-3 h-3 bg-gaming-gold rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                        <div className="w-3 h-3 bg-gaming-gold rounded-full animate-bounce" style={{animationDelay: '0.4s'}}></div>
                        <div className="w-3 h-3 bg-gaming-gold rounded-full animate-bounce" style={{animationDelay: '0.6s'}}></div>
                        <div className="w-3 h-3 bg-gaming-gold rounded-full animate-bounce" style={{animationDelay: '0.8s'}}></div>
                    </div>
                    <p className="text-gray-300">Loading games...</p>
                </div>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="min-h-screen bg-gaming-dark flex items-center justify-center">
                <div className="text-center">
                    <div className="text-red-500 text-6xl mb-4">⚠️</div>
                    <h2 className="text-2xl font-bold text-white mb-2">Error Loading Games</h2>
                    <p className="text-gray-300 mb-4">{error}</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="btn-gaming"
                    >
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gaming-dark">
            {/* Hero Banner Carousel */}
            <section className="relative h-96 overflow-hidden bg-gradient-to-br from-gaming-dark via-gaming-charcoal to-gaming-dark">
                {banners.length > 0 && banners[currentBanner] ? (
                    <>
                    {/* Banner with images */}
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={currentBanner}
                            initial={{ opacity: 0, x: 300 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -300 }}
                            transition={{ duration: 0.5 }}
                            className="absolute inset-0 flex items-center justify-center"
                            style={{
                                backgroundImage: `url(${banners[currentBanner]?.image || ''})`,
                                backgroundSize: 'cover',
                                backgroundPosition: 'center'
                            }}
                        >
                            {/* No dark overlay - show clean images */}
                            {/* Camera icon removed - manage via Controls/Banners */}
                        </motion.div>
                    </AnimatePresence>

                    {/* Navigation Arrows - Only show if multiple banners */}
                    {banners.length > 1 && (
                        <>
                            <button
                                onClick={prevBanner}
                                className="absolute left-4 top-1/2 transform -translate-y-1/2 p-4 bg-gaming-card/80 hover:bg-gaming-card text-white rounded-full border border-gaming-border transition-all duration-200 shadow-lg z-10"
                            >
                                <FiChevronLeft className="h-6 w-6" />
                            </button>

                            <button
                                onClick={nextBanner}
                                className="absolute right-4 top-1/2 transform -translate-y-1/2 p-4 bg-gaming-card/80 hover:bg-gaming-card text-white rounded-full border border-gaming-border transition-all duration-200 shadow-lg z-10"
                            >
                                <FiChevronRight className="h-6 w-6" />
                            </button>

                            {/* Banner Indicators */}
                            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2 z-10">
                                {banners.map((_, index) => (
                                    <button
                                        key={index}
                                        onClick={() => setCurrentBanner(index)}
                                        className={`w-3 h-3 rounded-full transition-all duration-200 ${index === currentBanner ? 'bg-gaming-gold' : 'bg-white/30'
                                            }`}
                                    />
                                ))}
                            </div>
                        </>
                    )}
                </>
            ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
                    <div className="text-6xl mb-4">🎮</div>
                    <h2 className="text-3xl font-gaming font-bold text-white mb-2">
                        Games Portal
                    </h2>
                    <p className="text-gray-400 max-w-md">
                        Explore all available games and join tournaments
                    </p>
                    <div className="mt-6 text-sm text-gray-500">
                        Banner images can be uploaded via Admin Panel → Image Management
                    </div>
                </div>
            )}
        </section>

            {/* Games Grid */}
            <section className="py-16">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-center mb-12"
                    >
                        <h2 className="text-3xl md:text-5xl font-gaming font-bold text-white mb-4">
                            ALL GAMES
                        </h2>
                        <p className="text-xl text-gray-400 max-w-2xl mx-auto">
                            Choose your battlefield and compete with the best players
                        </p>
                    </motion.div>

                    {/* Game Filter Buttons - Only show if multiple games */}
                    {games.length > 1 && (
                        <div className="mb-8 flex flex-wrap gap-2 justify-center">
                            {gameTypes.map((gameType) => (
                                <button
                                    key={gameType}
                                    onClick={() => setSelectedGameFilter(gameType)}
                                    className={`px-4 py-2 rounded-lg font-bold transition-all duration-200 ${
                                        selectedGameFilter === gameType
                                            ? 'bg-gaming-gold text-black'
                                            : 'bg-gaming-charcoal text-white hover:bg-gaming-slate border border-gaming-border'
                                    }`}
                                >
                                    {gameType === 'all' ? 'All Games' : gameType.toUpperCase()}
                                </button>
                            ))}
                        </div>
                    )}

                    {filteredGames.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {filteredGames.map((game, index) => (
                                <motion.div
                                    key={game.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.1 }}
                                >
                                    <GameCard game={game} />
                                </motion.div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-12">
                            <div className="text-6xl mb-4">🎮</div>
                            <h3 className="text-2xl font-bold text-white mb-2">No Games Available</h3>
                            <p className="text-gray-400">Games will be added soon. Stay tuned!</p>
                        </div>
                    )}
                </div>
            </section>

            {/* Call to Action */}
            <section className="py-16 bg-gaming-charcoal/30">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                    >
                        <h2 className="text-3xl md:text-5xl font-gaming font-bold text-white mb-6">
                            Ready to Compete?
                        </h2>
                        <p className="text-xl text-gray-300 mb-8">
                            Join tournaments across all your favorite games and win amazing prizes
                        </p>
                        <Link to="/tournaments" className="btn-gaming text-lg px-8 py-4">
                            Browse All Tournaments
                        </Link>
                    </motion.div>
                </div>
            </section>
        </div>
    );
};

export default GamesPage;
