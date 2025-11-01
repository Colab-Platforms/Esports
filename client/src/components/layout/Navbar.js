import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiMenu, 
  FiX, 
  FiLogOut, 
  FiSettings,
  FiTarget,
  FiDollarSign,
  FiGrid,
  FiBell
} from 'react-icons/fi';

import { selectAuth, logout } from '../../store/slices/authSlice';
import NotificationPanel from '../notifications/NotificationPanel';
import UserAvatar from '../common/UserAvatar';

const Navbar = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, user } = useSelector(selectAuth);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  const handleLogout = () => {
    dispatch(logout());
    navigate('/');
    setIsProfileMenuOpen(false);
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const toggleProfileMenu = () => {
    setIsProfileMenuOpen(!isProfileMenuOpen);
  };

  const isActiveLink = (path) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  const navLinks = [
    { to: '/', label: 'HOME' },
    { to: '/games', label: 'GAMES' },
    { to: '/bgmi', label: 'BGMI' },
    { to: '/tournaments', label: 'TOURNAMENTS' },
    { to: '/leaderboard', label: 'LEADERBOARD' },
  ];

  const authenticatedLinks = [
    { to: '/dashboard', label: 'DASHBOARD', icon: FiGrid },
    // { to: '/matches', label: 'MATCHES', icon: FiTarget },
    { to: '/wallet', label: 'WALLET', icon: FiDollarSign },
  ];

  return (
    <nav className="bg-gaming-charcoal border-b border-gaming-slate sticky top-0 z-50 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-gaming-neon to-gaming-neon-blue rounded-lg flex items-center justify-center shadow-lg">
              <img 
                src="https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=40&h=40&fit=crop&crop=center" 
                alt="Colab Esports Logo"
                className="w-6 h-6 rounded"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'block';
                }}
              />
              <span className="hidden text-white font-bold text-lg">🎮</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-gaming font-bold text-gaming-neon">
                Colab Esports
              </span>
              <span className="text-xs text-gray-400 -mt-1">Gaming Platform</span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`font-semibold transition-colors duration-200 ${
                  isActiveLink(link.to)
                    ? 'text-gaming-neon border-b-2 border-gaming-neon pb-1'
                    : 'text-gray-300 hover:text-gaming-gold'
                }`}
              >
                {link.label}
              </Link>
            ))}

            {isAuthenticated && authenticatedLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`font-semibold transition-colors duration-200 ${
                  isActiveLink(link.to)
                    ? 'text-gaming-neon border-b-2 border-gaming-neon pb-1'
                    : 'text-gray-300 hover:text-gaming-gold'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Desktop Auth Section */}
          <div className="hidden md:flex items-center space-x-4">
            {isAuthenticated ? (
              <div className="flex items-center space-x-4">
                {/* Notifications */}
                <NotificationPanel />

                {/* Wallet Balance */}
                <div className="px-3 py-2 bg-gaming-card border border-gaming-border rounded-lg text-sm">
                  <span className="text-gray-400">₹</span>
                  <span className="text-gaming-gold font-semibold">0</span>
                </div>

                {/* Profile Menu */}
                <div className="relative">
                  <button
                    onClick={toggleProfileMenu}
                    className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gaming-card transition-colors duration-200"
                  >
                    <UserAvatar 
                      user={user} 
                      size="sm" 
                      showStatus={true}
                      showLevel={true}
                    />
                    <div className="text-left">
                      <div className="text-sm font-medium text-white">{user?.username}</div>
                      <div className="text-xs text-gray-400">Level {user?.level || 1}</div>
                    </div>
                  </button>

                  <AnimatePresence>
                    {isProfileMenuOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute right-0 mt-2 w-48 bg-gaming-charcoal border border-gaming-slate rounded-lg shadow-lg py-2"
                      >
                        <Link
                          to="/profile"
                          className="flex items-center space-x-2 px-4 py-2 text-sm text-gray-300 hover:text-gaming-neon hover:bg-gaming-slate transition-colors duration-200"
                          onClick={() => setIsProfileMenuOpen(false)}
                        >
                          <FiSettings className="w-4 h-4" />
                          <span>Profile Settings</span>
                        </Link>
                        <button
                          onClick={handleLogout}
                          className="flex items-center space-x-2 px-4 py-2 text-sm text-gray-300 hover:text-red-400 hover:bg-gaming-slate transition-colors duration-200 w-full text-left"
                        >
                          <FiLogOut className="w-4 h-4" />
                          <span>Logout</span>
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            ) : (
              <div className="flex items-center space-x-4">
                <Link
                  to="/login"
                  className="text-gray-300 hover:text-gaming-neon transition-colors duration-200"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className="bg-gradient-neon text-gaming-dark px-4 py-2 rounded-lg font-semibold hover:shadow-gaming transition-all duration-200"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={toggleMobileMenu}
            className="md:hidden p-2 text-gray-300 hover:text-gaming-neon transition-colors duration-200"
          >
            {isMobileMenuOpen ? <FiX className="w-6 h-6" /> : <FiMenu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden border-t border-gaming-slate mt-4 pt-4 pb-4"
            >
              <div className="space-y-4">
                {navLinks.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={`font-semibold transition-colors duration-200 block py-2 ${
                      isActiveLink(link.to)
                        ? 'text-gaming-neon border-l-4 border-gaming-neon pl-4'
                        : 'text-gray-300 hover:text-gaming-gold'
                    }`}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    {link.label}
                  </Link>
                ))}

                {isAuthenticated ? (
                  <>
                    {authenticatedLinks.map((link) => (
                      <Link
                        key={link.to}
                        to={link.to}
                        className={`flex items-center space-x-2 transition-colors duration-200 py-2 ${
                          isActiveLink(link.to)
                            ? 'text-gaming-neon border-l-4 border-gaming-neon pl-4'
                            : 'text-gray-300 hover:text-gaming-neon'
                        }`}
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        <link.icon className="w-4 h-4" />
                        <span>{link.label}</span>
                      </Link>
                    ))}
                    <button
                      onClick={handleLogout}
                      className="flex items-center space-x-2 text-gray-300 hover:text-red-400 transition-colors duration-200"
                    >
                      <FiLogOut className="w-4 h-4" />
                      <span>Logout</span>
                    </button>
                  </>
                ) : (
                  <div className="space-y-2">
                    <Link
                      to="/login"
                      className="block text-gray-300 hover:text-gaming-neon transition-colors duration-200"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      Login
                    </Link>
                    <Link
                      to="/register"
                      className="block bg-gradient-neon text-gaming-dark px-4 py-2 rounded-lg font-semibold text-center"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      Sign Up
                    </Link>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </nav>
  );
};

export default Navbar;