import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiMenu, 
  FiX, 
  FiLogOut, 
  FiSettings,
  FiDollarSign,
  FiGrid
} from 'react-icons/fi';

import { selectAuth, logout } from '../../store/slices/authSlice';
import NotificationPanel from '../notifications/NotificationPanel';
import UserAvatar from '../common/UserAvatar';
// import ThemeToggle from '../common/ThemeToggle';

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
    { to: '/dashboard', label: 'MY CAREER', icon: FiGrid },
    // Wallet removed - free tournaments only
  ];

  return (
    <nav className="bg-theme-bg-card border-b border-theme-border sticky top-0 z-50 backdrop-blur-sm transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-theme-accent to-theme-accent-hover rounded-lg flex items-center justify-center shadow-lg">
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
              <span className="text-xl font-gaming font-bold text-theme-accent">
                Colab Esports
              </span>
              <span className="text-xs text-theme-text-muted -mt-1">Gaming Platform</span>
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
                    ? 'text-theme-accent border-b-2 border-theme-accent pb-1'
                    : 'text-theme-text-secondary hover:text-theme-accent'
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
                    ? 'text-theme-accent border-b-2 border-theme-accent pb-1'
                    : 'text-theme-text-secondary hover:text-theme-accent'
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
                {/* Theme Toggle */}
                {/* <ThemeToggle size="sm" /> */}
                
                {/* Notifications */}
                <NotificationPanel />

                {/* Wallet removed - free tournaments only */}

                {/* Profile Menu */}
                <div className="relative">
                  <button
                    onClick={toggleProfileMenu}
                    className="flex items-center space-x-3 p-2 rounded-lg hover:bg-theme-bg-hover transition-colors duration-200"
                  >
                    <UserAvatar 
                      user={user} 
                      size="sm" 
                      showStatus={true}
                      showLevel={true}
                    />
                    <div className="text-left">
                      <div className="text-sm font-medium text-theme-text-primary">{user?.username}</div>
                      <div className="text-xs text-theme-text-muted">Level {user?.level || 1}</div>
                    </div>
                  </button>

                  <AnimatePresence>
                    {isProfileMenuOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute right-0 mt-2 w-48 bg-theme-bg-card border border-theme-border rounded-lg shadow-lg py-2"
                      >
                        <Link
                          to="/profile"
                          className="flex items-center space-x-2 px-4 py-2 text-sm text-theme-text-secondary hover:text-theme-accent hover:bg-theme-bg-hover transition-colors duration-200"
                          onClick={() => setIsProfileMenuOpen(false)}
                        >
                          <FiSettings className="w-4 h-4" />
                          <span>Profile Settings</span>
                        </Link>
                        
                        {/* Admin Link - Only for admin users */}
                        {user?.role === 'admin' && (
                          <Link
                            to="/admin"
                            className="flex items-center space-x-2 px-4 py-2 text-sm text-gaming-gold hover:text-yellow-400 hover:bg-theme-bg-hover transition-colors duration-200 font-bold"
                            onClick={() => setIsProfileMenuOpen(false)}
                          >
                            <FiGrid className="w-4 h-4" />
                            <span>Admin Panel</span>
                          </Link>
                        )}
                        
                        <button
                          onClick={handleLogout}
                          className="flex items-center space-x-2 px-4 py-2 text-sm text-theme-text-secondary hover:text-red-400 hover:bg-theme-bg-hover transition-colors duration-200 w-full text-left"
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
                {/* <ThemeToggle size="sm" /> */}
                <Link
                  to="/login"
                  className="text-theme-text-secondary hover:text-theme-accent transition-colors duration-200"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className="bg-theme-accent hover:bg-theme-accent-hover text-white px-4 py-2 rounded-lg font-semibold transition-all duration-200"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={toggleMobileMenu}
            className="md:hidden p-2 text-theme-text-secondary hover:text-theme-accent transition-colors duration-200"
          >
            {isMobileMenuOpen ? <FiX className="w-6 h-6" /> : <FiMenu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Mobile Menu Sidebar */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'tween', duration: 0.3 }}
            className="fixed top-0 left-0 h-screen w-80 max-w-[85vw] bg-theme-bg-card border-r border-theme-border z-50 md:hidden overflow-y-auto shadow-2xl"
          >
            {/* Mobile Menu Header */}
            <div className="flex items-center justify-between p-4 border-b border-theme-border">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-br from-theme-accent to-theme-accent-hover rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">🎮</span>
                </div>
                <span className="text-lg font-gaming font-bold text-theme-accent">Colab Esports</span>
              </div>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2 text-theme-text-secondary hover:text-theme-accent transition-colors"
              >
                <FiX className="w-6 h-6" />
              </button>
            </div>

            {/* Mobile Menu Content */}
            <div className="p-4 pb-8 min-h-full">
              {/* User Profile Section (if authenticated) */}
              {isAuthenticated && (
                <div className="mb-6 p-4 bg-theme-bg-primary rounded-lg border border-theme-border">
                  <div className="flex items-center space-x-3 mb-4">
                    <UserAvatar user={user} size="md" showStatus={true} />
                    <div>
                      <div className="text-theme-text-primary font-semibold">{user?.username}</div>
                      <div className="text-xs text-theme-text-muted">Level {user?.level || 1}</div>
                    </div>
                  </div>
                  {/* Wallet balance removed - free tournaments only */}
                  <div className="flex items-center justify-between">
                    <span className="text-theme-text-muted text-sm">Theme</span>
                    {/* <ThemeToggle size="sm" /> */}
                  </div>
                </div>
              )}

              {/* Navigation Links */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-theme-text-muted uppercase tracking-wider mb-3">
                  Navigation
                </div>
                {navLinks.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={`flex items-center space-x-3 px-3 py-3 rounded-lg transition-colors duration-200 ${
                      isActiveLink(link.to)
                        ? 'bg-theme-accent/10 text-theme-accent border-l-4 border-theme-accent'
                        : 'text-theme-text-secondary hover:text-theme-accent hover:bg-theme-bg-hover'
                    }`}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <span className="font-medium">{link.label}</span>
                  </Link>
                ))}

                {isAuthenticated && (
                  <>
                    <div className="text-xs font-semibold text-theme-text-muted uppercase tracking-wider mb-3 mt-6">
                      Account
                    </div>
                    {authenticatedLinks.map((link) => (
                      <Link
                        key={link.to}
                        to={link.to}
                        className={`flex items-center space-x-3 px-3 py-3 rounded-lg transition-colors duration-200 ${
                          isActiveLink(link.to)
                            ? 'bg-theme-accent/10 text-theme-accent border-l-4 border-theme-accent'
                            : 'text-theme-text-secondary hover:text-theme-accent hover:bg-theme-bg-hover'
                        }`}
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        <link.icon className="w-5 h-5" />
                        <span className="font-medium">{link.label}</span>
                      </Link>
                    ))}
                    <Link
                      to="/profile"
                      className="flex items-center space-x-3 px-3 py-3 rounded-lg text-theme-text-secondary hover:text-theme-accent hover:bg-theme-bg-hover transition-colors duration-200"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      <FiSettings className="w-5 h-5" />
                      <span className="font-medium">Profile Settings</span>
                    </Link>
                    {/* Steam Integration link removed */}
                    <button
                      onClick={handleLogout}
                      className="flex items-center space-x-3 px-3 py-3 rounded-lg text-theme-text-secondary hover:text-red-400 hover:bg-theme-bg-hover transition-colors duration-200 w-full text-left"
                    >
                      <FiLogOut className="w-5 h-5" />
                      <span className="font-medium">Logout</span>
                    </button>
                  </>
                )}

                {!isAuthenticated && (
                  <>
                    <div className="text-xs font-semibold text-theme-text-muted uppercase tracking-wider mb-3 mt-6">
                      Account
                    </div>
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-theme-text-muted text-sm">Theme</span>
                        {/* <ThemeToggle size="sm" /> */}
                      </div>
                    </div>
                    <Link
                      to="/login"
                      className="flex items-center space-x-3 px-3 py-3 rounded-lg text-theme-text-secondary hover:text-theme-accent hover:bg-theme-bg-hover transition-colors duration-200"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      <span className="font-medium">Login</span>
                    </Link>
                    <Link
                      to="/register"
                      className="flex items-center space-x-3 px-3 py-3 rounded-lg bg-theme-accent hover:bg-theme-accent-hover text-white font-semibold transition-all duration-200"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      <span className="font-medium">Sign Up</span>
                    </Link>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Navbar;