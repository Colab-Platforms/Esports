// High-quality gaming images and assets
export const gameImages = {
  // Game Logos and Banners
  bgmi: {
    logo: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&h=600&fit=crop&crop=center',
    banner: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1200&h=400&fit=crop&crop=center',
    thumbnail: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=400&h=300&fit=crop&crop=center',
    icon: '🎮'
  },
  cs2: {
    logo: 'https://images.unsplash.com/photo-1560253023-3ec5d502959f?w=800&h=600&fit=crop&crop=center',
    banner: 'https://images.unsplash.com/photo-1560253023-3ec5d502959f?w=1200&h=400&fit=crop&crop=center',
    thumbnail: 'https://images.unsplash.com/photo-1560253023-3ec5d502959f?w=400&h=300&fit=crop&crop=center',
    icon: '⚡'
  },
  valorant: {
    logo: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=800&h=600&fit=crop&crop=center',
    banner: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=1200&h=400&fit=crop&crop=center',
    thumbnail: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=400&h=300&fit=crop&crop=center',
    icon: '🎯'
  },
  freefire: {
    logo: 'https://images.unsplash.com/photo-1493711662062-fa541adb3fc8?w=800&h=600&fit=crop&crop=center',
    banner: 'https://images.unsplash.com/photo-1493711662062-fa541adb3fc8?w=1200&h=400&fit=crop&crop=center',
    thumbnail: 'https://images.unsplash.com/photo-1493711662062-fa541adb3fc8?w=400&h=300&fit=crop&crop=center',
    icon: '🔥'
  },
  ml: {
    logo: 'https://images.unsplash.com/photo-1556438064-2d7646166914?w=800&h=600&fit=crop&crop=center',
    banner: 'https://images.unsplash.com/photo-1556438064-2d7646166914?w=1200&h=400&fit=crop&crop=center',
    thumbnail: 'https://images.unsplash.com/photo-1556438064-2d7646166914?w=400&h=300&fit=crop&crop=center',
    icon: '🏆'
  }
};

// Hero Section Images
export const heroImages = {
  mainBanner: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1920&h=1080&fit=crop&crop=center',
  gamingSetup: 'https://images.unsplash.com/photo-1593305841991-05c297ba4575?w=1200&h=800&fit=crop&crop=center',
  esportsArena: 'https://images.unsplash.com/photo-1560253023-3ec5d502959f?w=1200&h=800&fit=crop&crop=center',
  tournament: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=1200&h=800&fit=crop&crop=center'
};

// Tournament Images
export const tournamentImages = {
  championship: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&h=600&fit=crop&crop=center',
  arena: 'https://images.unsplash.com/photo-1560253023-3ec5d502959f?w=800&h=600&fit=crop&crop=center',
  competition: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=800&h=600&fit=crop&crop=center',
  victory: 'https://images.unsplash.com/photo-1493711662062-fa541adb3fc8?w=800&h=600&fit=crop&crop=center',
  team: 'https://images.unsplash.com/photo-1556438064-2d7646166914?w=800&h=600&fit=crop&crop=center'
};

// User Avatar Placeholders
export const avatarImages = {
  default: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop&crop=face',
  gamer1: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
  gamer2: 'https://images.unsplash.com/photo-1494790108755-2616c9c0e8e0?w=150&h=150&fit=crop&crop=face',
  gamer3: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
  gamer4: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face'
};

// Background Images
export const backgroundImages = {
  gaming: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1920&h=1080&fit=crop&crop=center',
  neon: 'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=1920&h=1080&fit=crop&crop=center',
  cyber: 'https://images.unsplash.com/photo-1560253023-3ec5d502959f?w=1920&h=1080&fit=crop&crop=center',
  esports: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=1920&h=1080&fit=crop&crop=center'
};

// Icon Images
export const iconImages = {
  trophy: 'https://images.unsplash.com/photo-1567427017947-545c5f8d16ad?w=100&h=100&fit=crop&crop=center',
  medal: 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=100&h=100&fit=crop&crop=center',
  crown: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=100&h=100&fit=crop&crop=center',
  star: 'https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=100&h=100&fit=crop&crop=center'
};

// Utility function to get game image
export const getGameImage = (gameType, imageType = 'thumbnail') => {
  const game = gameImages[gameType?.toLowerCase()];
  return game ? game[imageType] : gameImages.bgmi[imageType];
};

// Utility function to get random tournament image
export const getRandomTournamentImage = () => {
  const images = Object.values(tournamentImages);
  return images[Math.floor(Math.random() * images.length)];
};

// Utility function to get random avatar
export const getRandomAvatar = () => {
  const avatars = Object.values(avatarImages);
  return avatars[Math.floor(Math.random() * avatars.length)];
};