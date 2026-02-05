import React, { useEffect } from 'react';
import { Routes, Route, Navigate, useParams, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';

// Console configuration - must be imported first
import './config/console';

// Context
import { ThemeProvider } from './contexts/ThemeContextSimple';

// Redux
import { selectAuth } from './store/slices/authSlice';

// Components
import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';
import LoadingSpinner from './components/common/LoadingSpinner';

// Pages
import HomePage from './pages/HomePage';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';
import OAuthSuccess from './pages/auth/OAuthSuccess';
import OAuthError from './pages/auth/OAuthError';
import DashboardPage from './pages/DashboardPage';
import TournamentsPage from './pages/tournaments/TournamentsPage';
import TournamentDetailsPage from './pages/tournaments/TournamentDetailsPage';
import LeaderboardPage from './pages/LeaderboardPage';
// import WalletPage from './pages/WalletPage';
import ProfilePage from './pages/ProfilePage';
import ProfileSettingsPage from './pages/ProfileSettingsPage';
import GamesPage from './pages/GamesPage';
import TeamsPage from './pages/TeamsPage';
import PublicProfile from './pages/PublicProfile';
import AdminDashboard from './pages/admin/AdminDashboard';
import GamesManagement from './pages/admin/GamesManagement';
import TournamentManagement from './pages/admin/TournamentManagement';
import ImageUploadPage from './pages/admin/ImageUploadPage';
import ImageManagement from './pages/admin/ImageManagement';
import AdminBGMIRegistrations from './pages/AdminBGMIRegistrations';
import AdminLiveStreamManager from './pages/admin/AdminLiveStreamManager';
import SingleTournamentPage from './pages/tournaments/SingleTournamentPage';
import NotFoundPage from './pages/NotFoundPage';
import BGMIPage from './pages/BGMIPage';
import BGMIImageUpload from './pages/BGMIImageUpload';
import CS2Page from './pages/CS2Page';
import FreeFirePage from './pages/FreeFirePage';
import TournamentDetails from './pages/tournaments/TournamentDetails';
import SteamSettingsPage from './pages/SteamSettingsPage';
// import SplashScreen from './components/common/SplashScreen';
import SplashScreen from './components/common/PremiumSplashScreen';

// Match Components
import MatchHistory from './components/matches/MatchHistory';
import MatchRoom from './components/matches/MatchRoom';
import ResultSubmission from './components/matches/ResultSubmission';

// Services
import { initializeSocket, disconnectSocket } from './utils/socket';
import notificationService from './services/notificationService';
import { Analytics } from "@vercel/analytics/react"

// Game Router Component
const GameRouter = () => {
  const { gameType } = useParams();
  
  switch(gameType?.toLowerCase()) {
    case 'bgmi':
    case 'battlegrounds mobile india':
      return <BGMIPage />;
    case 'ff':
    case 'free fire':
      return <FreeFirePage />;
    case 'cs2':
    case 'counter-strike 2':
    case 'counter strike 2':
      return <CS2Page />;
    case 'valorant':
      return <Navigate to="/games" replace />;
    default:
      return <Navigate to="/games" replace />;
  }
};

// Temporary ProtectedRoute component
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated } = useSelector(selectAuth);
  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

// Admin Route component - checks for admin role
const AdminRoute = ({ children }) => {
  const { isAuthenticated, user } = useSelector(selectAuth);
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  // Allow access if user is admin OR if role is not set (for backward compatibility)
  // This allows existing users to access admin panel if they were made admin in DB
  const isAdmin = user?.role === 'admin' || user?.role === undefined;
  
  if (!isAdmin) {
    console.log('❌ Access denied: User is not admin');
    return <Navigate to="/" replace />;
  }
  
  return children;
};

// Designer Route component - checks for designer or admin role
const DesignerRoute = ({ children }) => {
  const { isAuthenticated, user } = useSelector(selectAuth);
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  // Allow access if user is designer or admin
  const canAccess = user?.role === 'designer' || user?.role === 'admin';
  
  if (!canAccess) {
    console.log('❌ Access denied: User is not designer or admin');
    return <Navigate to="/" replace />;
  }
  
  return children;
};

// Wrapper components for route parameters
const MatchRoomWrapper = () => {
  const { id } = useParams();
  return <MatchRoom matchId={id} />;
};

const ResultSubmissionWrapper = () => {
  const { id } = useParams();
  return <ResultSubmission matchId={id} />;
};

function App() {
  const dispatch = useDispatch();
  const { isAuthenticated, isLoading, user } = useSelector(selectAuth);
  const location = useLocation();
  
  // Check if splash has been shown before (only show once per session)
  const [showSplash, setShowSplash] = React.useState(() => {
    const hasSeenSplash = sessionStorage.getItem('hasSeenSplash');
    return !hasSeenSplash; // Show splash only if not seen before in this session
  });

  // Check if current page is an auth page (hide footer on these pages)
  const isAuthPage = location.pathname.startsWith('/login') || 
                     location.pathname.startsWith('/register') || 
                     location.pathname.startsWith('/forgot-password') || 
                     location.pathname.startsWith('/reset-password');

  useEffect(() => {
    // Monitor Web Vitals for performance tracking
    if ('PerformanceObserver' in window) {
      try {
        // Monitor LCP (Largest Contentful Paint)
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          const lcp = lastEntry.renderTime || lastEntry.loadTime;
          console.log('📊 LCP:', Math.round(lcp), 'ms');
        }).observe({ entryTypes: ['largest-contentful-paint'] });

        // Monitor CLS (Cumulative Layout Shift)
        let clsValue = 0;
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!entry.hadRecentInput) {
              clsValue += entry.value;
            }
          }
          console.log('📊 CLS:', clsValue.toFixed(3));
        }).observe({ entryTypes: ['layout-shift'] });

        // Monitor FCP (First Contentful Paint)
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.name === 'first-contentful-paint') {
              console.log('📊 FCP:', Math.round(entry.startTime), 'ms');
            }
          }
        }).observe({ entryTypes: ['paint'] });
      } catch (error) {
        console.error('Error monitoring Web Vitals:', error);
      }
    }

    // Expose function to clear splash cache for testing
    window.clearSplashCache = () => {
      localStorage.removeItem('lastSplashTime');
      console.log('✅ Splash cache cleared. Reload page to see splash screen.');
    };
  }, []);

  useEffect(() => {
    // Initialize socket connection if authenticated
    if (isAuthenticated && user) {
      initializeSocket(user.id, dispatch);
      
      // Initialize notification service
      notificationService.init(dispatch);
      
      // Request notification permission
      notificationService.requestNotificationPermission();
    } else {
      disconnectSocket();
      notificationService.stopTournamentMonitoring();
    }

    // Cleanup on unmount
    return () => {
      disconnectSocket();
      notificationService.stopTournamentMonitoring();
    };
  }, [isAuthenticated, user, dispatch]);

  // Show splash screen on first load only
  if (showSplash) {
    return <SplashScreen onComplete={() => {
      setShowSplash(false);
      // Mark as seen in this session
      sessionStorage.setItem('hasSeenSplash', 'true');
    }} />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gaming-dark flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <ThemeProvider>
      <Analytics/>
      <div className="min-h-screen bg-theme-bg-primary text-theme-text-primary flex flex-col transition-colors duration-300">
      {/* Navigation */}
      <Navbar />
      
      {/* Main Content */}
      <main className="flex-1">
        <AnimatePresence mode="wait">
          <Routes>
            {/* Public Routes */}
            <Route 
              path="/" 
              element={
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <HomePage />
                </motion.div>
              } 
            />
            
            {/* Auth Routes */}
            <Route 
              path="/login" 
              element={
                isAuthenticated ? (
                  <Navigate to="/profile" replace />
                ) : (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.3 }}
                  >
                    <LoginPage />
                  </motion.div>
                )
              } 
            />
            
            <Route 
              path="/register" 
              element={
                isAuthenticated ? (
                  <Navigate to="/profile" replace />
                ) : (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.3 }}
                  >
                    <RegisterPage />
                  </motion.div>
                )
              } 
            />
            
            {/* Forgot Password Routes */}
            <Route 
              path="/forgot-password" 
              element={
                isAuthenticated ? (
                  <Navigate to="/profile" replace />
                ) : (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.3 }}
                  >
                    <ForgotPasswordPage />
                  </motion.div>
                )
              } 
            />
            
            <Route 
              path="/reset-password/:token" 
              element={
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3 }}
                >
                  <ResetPasswordPage />
                </motion.div>
              } 
            />
            
            {/* OAuth Routes */}
            <Route 
              path="/auth/success" 
              element={<OAuthSuccess />} 
            />
            
            <Route 
              path="/auth/error" 
              element={<OAuthError />} 
            />
            
            {/* Games Route */}
            <Route 
              path="/games" 
              element={
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <GamesPage />
                </motion.div>
              } 
            />
            
            {/* BGMI Route */}
            <Route 
              path="/bgmi" 
              element={
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <BGMIPage />
                </motion.div>
              } 
            />
            
            {/* Free Fire Route */}
            <Route 
              path="/freefire" 
              element={
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <FreeFirePage />
                </motion.div>
              } 
            />
            
            {/* BGMI Image Upload Route */}
            <Route 
              path="/bgmi/registration/:registrationId/upload-images" 
              element={
                <ProtectedRoute>
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                  >
                    <BGMIImageUpload />
                  </motion.div>
                </ProtectedRoute>
              } 
            />

            {/* CS2 Route */}
            <Route 
              path="/cs2" 
              element={
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <CS2Page />
                </motion.div>
              } 
            />

            {/* Protected Routes */}
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute>
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                  >
                    <DashboardPage />
                  </motion.div>
                </ProtectedRoute>
              } 
            />
            
            <Route 
              path="/tournaments" 
              element={
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <TournamentsPage />
                </motion.div>
              } 
            />
            
            <Route 
              path="/tournaments/:id" 
              element={
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <SingleTournamentPage />
                </motion.div>
              } 
            />
            
            <Route 
              path="/tournament/:id" 
              element={
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <SingleTournamentPage />
                </motion.div>
              } 
            />
            
            {/* Dynamic Game Route - Redirects to specific game pages */}
            <Route 
              path="/game/:gameType" 
              element={
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <GameRouter />
                </motion.div>
              } 
            />
            
            <Route 
              path="/leaderboard" 
              element={
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <LeaderboardPage />
                </motion.div>
              } 
            />
            
            {/* Wallet route removed - free tournaments only */}
            
            <Route 
              path="/profile" 
              element={
                <ProtectedRoute>
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                  >
                    <ProfilePage />
                  </motion.div>
                </ProtectedRoute>
              } 
            />
            
            <Route 
              path="/profile/settings" 
              element={
                <ProtectedRoute>
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                  >
                    <ProfileSettingsPage />
                  </motion.div>
                </ProtectedRoute>
              } 
            />
            
            <Route 
              path="/teams" 
              element={
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <TeamsPage />
                </motion.div>
              } 
            />
            
            <Route 
              path="/player/:username" 
              element={
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <PublicProfile />
                </motion.div>
              } 
            />
            
            <Route 
              path="/steam-settings" 
              element={
                <ProtectedRoute>
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                  >
                    <SteamSettingsPage />
                  </motion.div>
                </ProtectedRoute>
              } 
            />
            
            {/* Match Routes */}
            <Route 
              path="/matches" 
              element={
                <ProtectedRoute>
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                  >
                    <MatchHistory />
                  </motion.div>
                </ProtectedRoute>
              } 
            />
            
            <Route 
              path="/matches/:id" 
              element={
                <ProtectedRoute>
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                  >
                    <MatchRoomWrapper />
                  </motion.div>
                </ProtectedRoute>
              } 
            />
            
            {/* Admin Routes */}
            <Route 
              path="/admin" 
              element={
                <AdminRoute>
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                  >
                    <AdminDashboard />
                  </motion.div>
                </AdminRoute>
              } 
            />
            
            <Route 
              path="/admin/games" 
              element={
                <AdminRoute>
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                  >
                    <GamesManagement />
                  </motion.div>
                </AdminRoute>
              } 
            />

            <Route 
              path="/admin/tournaments" 
              element={
                <AdminRoute>
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                  >
                    <TournamentManagement />
                  </motion.div>
                </AdminRoute>
              } 
            />

            <Route 
              path="/admin/images" 
              element={
                <DesignerRoute>
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                  >
                    <ImageManagement />
                  </motion.div>
                </DesignerRoute>
              } 
            />

            <Route 
              path="/admin/images" 
              element={
                <AdminRoute>
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                  >
                    <ImageUploadPage />
                  </motion.div>
                </AdminRoute>
              } 
            />

            <Route 
              path="/admin/bgmi-registrations" 
              element={
                <AdminRoute>
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                  >
                    <AdminBGMIRegistrations />
                  </motion.div>
                </AdminRoute>
              } 
            />

            <Route 
              path="/admin/live-stream" 
              element={
                <AdminRoute>
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                  >
                    <AdminLiveStreamManager />
                  </motion.div>
                </AdminRoute>
              } 
            />
            
            <Route 
              path="/matches/:id/submit-result" 
              element={
                <ProtectedRoute>
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                  >
                    <ResultSubmissionWrapper />
                  </motion.div>
                </ProtectedRoute>
              } 
            />
            
            {/* 404 Route */}
            <Route 
              path="*" 
              element={
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3 }}
                >
                  <NotFoundPage />
                </motion.div>
              } 
            />
          </Routes>
        </AnimatePresence>
      </main>
      
      {/* Footer - Hidden on auth pages */}
      {!isAuthPage && <Footer />}
      </div>
    </ThemeProvider>
  );
}

export default App;