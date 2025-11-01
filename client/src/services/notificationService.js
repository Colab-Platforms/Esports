import { addNotification } from '../store/slices/notificationSlice';

class NotificationService {
  constructor() {
    this.dispatch = null;
    this.lastTournamentCheck = new Date();
    this.checkInterval = null;
  }

  // Initialize with Redux dispatch
  init(dispatch) {
    this.dispatch = dispatch;
    this.startTournamentMonitoring();
  }

  // Start monitoring for new tournaments
  startTournamentMonitoring() {
    // Check for new tournaments every 30 seconds
    this.checkInterval = setInterval(() => {
      this.checkForNewTournaments();
    }, 30000);

    // Initial check
    this.checkForNewTournaments();
  }

  // Stop monitoring
  stopTournamentMonitoring() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  // Check for new tournaments
  async checkForNewTournaments() {
    try {
      const response = await fetch('/api/tournaments?limit=5&sort=createdAt');
      const data = await response.json();

      if (data.success && data.data.tournaments) {
        const tournaments = data.data.tournaments;
        
        tournaments.forEach(tournament => {
          const tournamentCreated = new Date(tournament.createdAt);
          
          // If tournament was created after our last check
          if (tournamentCreated > this.lastTournamentCheck) {
            this.showTournamentNotification(tournament);
          }
        });

        // Update last check time
        this.lastTournamentCheck = new Date();
      }
    } catch (error) {
      console.error('Failed to check for new tournaments:', error);
    }
  }

  // Show tournament notification
  showTournamentNotification(tournament) {
    if (!this.dispatch) return;

    const notification = {
      _id: `tournament_${tournament._id}_${Date.now()}`,
      type: 'tournament',
      title: 'New Tournament Available!',
      message: `${tournament.name} - Prize Pool: ₹${tournament.prizePool?.toLocaleString() || '0'}`,
      data: {
        tournamentId: tournament._id,
        gameType: tournament.gameType,
        prizePool: tournament.prizePool,
        entryFee: tournament.entryFee
      },
      isRead: false,
      createdAt: new Date().toISOString(),
      actionUrl: `/tournaments/${tournament._id}`
    };

    // Add to Redux store
    this.dispatch(addNotification(notification));

    // Show browser notification if permission granted
    this.showBrowserNotification(notification);

    // Show in-app toast notification
    this.showToastNotification(notification);
  }

  // Show browser notification
  showBrowserNotification(notification) {
    if ('Notification' in window && Notification.permission === 'granted') {
      const browserNotification = new Notification(notification.title, {
        body: notification.message,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: notification._id,
        requireInteraction: false,
        silent: false
      });

      // Auto close after 5 seconds
      setTimeout(() => {
        browserNotification.close();
      }, 5000);

      // Handle click
      browserNotification.onclick = () => {
        window.focus();
        window.location.href = notification.actionUrl;
        browserNotification.close();
      };
    }
  }

  // Show toast notification
  showToastNotification(notification) {
    // Create toast element
    const toast = document.createElement('div');
    toast.className = 'fixed top-4 right-4 bg-gaming-card border border-gaming-neon rounded-lg p-4 shadow-lg z-50 max-w-sm transform translate-x-full transition-transform duration-300';
    toast.innerHTML = `
      <div class="flex items-start space-x-3">
        <div class="flex-shrink-0">
          <div class="w-8 h-8 bg-gaming-neon rounded-full flex items-center justify-center">
            <span class="text-black font-bold text-sm">🎮</span>
          </div>
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-white">${notification.title}</p>
          <p class="text-sm text-gray-300 mt-1">${notification.message}</p>
          <div class="mt-2 flex space-x-2">
            <button class="text-xs text-gaming-neon hover:text-gaming-neon/80 font-medium" onclick="window.location.href='${notification.actionUrl}'">
              View Tournament
            </button>
            <button class="text-xs text-gray-400 hover:text-gray-300" onclick="this.closest('.fixed').remove()">
              Dismiss
            </button>
          </div>
        </div>
        <button class="flex-shrink-0 text-gray-400 hover:text-white" onclick="this.closest('.fixed').remove()">
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
          </svg>
        </button>
      </div>
    `;

    document.body.appendChild(toast);

    // Animate in
    setTimeout(() => {
      toast.classList.remove('translate-x-full');
    }, 100);

    // Auto remove after 8 seconds
    setTimeout(() => {
      toast.classList.add('translate-x-full');
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, 8000);
  }

  // Request notification permission
  async requestNotificationPermission() {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    return false;
  }

  // Show custom notification
  showCustomNotification(type, title, message, actionUrl = null) {
    if (!this.dispatch) return;

    const notification = {
      _id: `custom_${Date.now()}`,
      type,
      title,
      message,
      isRead: false,
      createdAt: new Date().toISOString(),
      actionUrl
    };

    this.dispatch(addNotification(notification));
    this.showToastNotification(notification);
  }

  // Show registration success notification
  showRegistrationSuccess(tournamentName) {
    this.showCustomNotification(
      'success',
      'Registration Successful!',
      `You have successfully registered for ${tournamentName}`,
      '/dashboard'
    );
  }

  // Show wallet update notification
  showWalletUpdate(amount, type) {
    const message = type === 'deposit' 
      ? `₹${amount} added to your wallet`
      : `₹${amount} deducted from your wallet`;
    
    this.showCustomNotification(
      'wallet',
      'Wallet Updated',
      message,
      '/wallet'
    );
  }

  // Show match notification
  showMatchNotification(matchInfo) {
    this.showCustomNotification(
      'match',
      'Match Starting Soon!',
      `Your match for ${matchInfo.tournamentName} starts in 10 minutes`,
      `/matches/${matchInfo.matchId}`
    );
  }
}

// Create singleton instance
const notificationService = new NotificationService();

export default notificationService;