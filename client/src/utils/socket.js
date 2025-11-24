import { io } from 'socket.io-client';

let socket = null;

export const initializeSocket = (userId, dispatch) => {
  if (socket) {
    socket.disconnect();
  }

  socket = io(process.env.REACT_APP_SERVER_URL || 'http://localhost:5001', {
    auth: {
      userId
    }
  });

  socket.on('connect', () => {
    console.log('🔌 Connected to server');
  });

  socket.on('disconnect', () => {
    console.log('🔌 Disconnected from server');
  });

  // Tournament updates
  socket.on('tournament-update', (data) => {
    dispatch({ type: 'tournaments/updateTournament', payload: data });
  });

  // Match updates
  socket.on('match-update', (data) => {
    dispatch({ type: 'matches/updateMatch', payload: data });
  });

  // Leaderboard updates
  socket.on('leaderboard-update', (data) => {
    dispatch({ type: 'leaderboard/updateLeaderboard', payload: data });
  });

  // Wallet updates removed - free tournaments only

  // Notifications
  socket.on('notification', (data) => {
    dispatch({ type: 'notifications/addNotification', payload: data });
  });

  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export const joinTournament = (tournamentId) => {
  if (socket) {
    socket.emit('join-tournament', tournamentId);
  }
};

export const leaveTournament = (tournamentId) => {
  if (socket) {
    socket.emit('leave-tournament', tournamentId);
  }
};

export const getSocket = () => socket;