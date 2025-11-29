import React, { useEffect } from 'react';
import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';

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
import DashboardPage from './pages/DashboardPage';
import TournamentsPage from './pages/tournaments/TournamentsPage';
import TournamentDetailsPage from './pages/tournaments/TournamentDetailsPage';
import LeaderboardPage from './pages/LeaderboardPage';
// import WalletPage from './pages/WalletPage';
import ProfilePage from './pages/ProfilePage';
import ProfileSettingsPage from './pages/ProfileSettingsPage';
import GamesPage from './pages/GamesPage';
import AdminDashboard from './pages/admin/AdminDashboard';
import GamesManagement from './pages/admin/GamesManagement';
import TournamentManagement from './pages/admin/TournamentManagement';
import SingleTournamentPage from './pages/tournaments/SingleTournamentPage';
import NotFoundPage from './pages/NotFoundPage';
import BGMIPage from './pages/BGMIPage';
import CS2Page from './pages/CS2Page';
// import BGMITournamentDetails from './pages/tournaments/BGMITournamentDetails';
import SteamSettingsPage from './pages/SteamSettingsPage';

// Match Components
import MatchHistory from './components/matches/MatchHistory';
import MatchRoom from './components/matches/MatchRoom';
import ResultSubmission from './components/matches/ResultSubmission';

// Services
import { initializeSocket, disconnectSocket } from './utils/socket';
import notificationService from './services/notificationService';

// Game Router Component
const GameRouter = () => {
  const { gameType } = useParams();
  
  switch(gameType?.toLowerCase()) {
    case 'bgmi':
    case 'battlegrounds mobile india':
      return <BGMIPage />;
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gaming-dark flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <ThemeProvider>
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
                  <Navigate to="/dashboard" replace />
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
                  <Navigate to="/dashboard" replace />
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
      
      {/* Footer */}
      <Footer />
      </div>
    </ThemeProvider>
  );
}

export default App;