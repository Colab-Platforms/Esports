const Game = require('../models/Game');

const gamesData = [
  {
    id: 'valorant',
    name: 'VALORANT',
    icon: '🎯',
    category: 'PC',
    description: 'Tactical FPS with unique agent abilities',
    background: 'linear-gradient(135deg, #ff4655 0%, #2c1810 100%)',
    backgroundImage: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=1920&h=1080&fit=crop&crop=center',
    logo: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=200&h=200&fit=crop&crop=center',
    tournaments: 15,
    activePlayers: '2.5K+',
    totalPrize: '₹5,00,000',
    featured: true,
    order: 1
  },
  {
    id: 'bgmi',
    name: 'BGMI',
    icon: '📱',
    category: 'Mobile',
    description: 'Battle Royale survival on mobile',
    background: 'linear-gradient(135deg, #ff6b35 0%, #2c1810 100%)',
    backgroundImage: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1920&h=1080&fit=crop&crop=center',
    logo: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=200&h=200&fit=crop&crop=center',
    tournaments: 25,
    activePlayers: '5K+',
    totalPrize: '₹8,00,000',
    featured: true,
    order: 2
  },
  {
    id: 'cs2',
    name: 'CS2',
    icon: '⚡',
    category: 'PC',
    description: 'Counter-Strike competitive gaming',
    background: 'linear-gradient(135deg, #1e3c72 0%, #2c1810 100%)',
    backgroundImage: 'https://images.unsplash.com/photo-1560253023-3ec5d502959f?w=1920&h=1080&fit=crop&crop=center',
    logo: 'https://images.unsplash.com/photo-1560253023-3ec5d502959f?w=200&h=200&fit=crop&crop=center',
    tournaments: 12,
    activePlayers: '1.8K+',
    totalPrize: '₹3,00,000',
    featured: true,
    order: 3
  },
  {
    id: 'freefire',
    name: 'FREE FIRE',
    icon: '🔥',
    category: 'Mobile',
    description: 'Fast-paced 10-minute battles',
    background: 'linear-gradient(135deg, #ff9500 0%, #2c1810 100%)',
    backgroundImage: 'https://images.unsplash.com/photo-1493711662062-fa541adb3fc8?w=1920&h=1080&fit=crop&crop=center',
    logo: 'https://images.unsplash.com/photo-1493711662062-fa541adb3fc8?w=200&h=200&fit=crop&crop=center',
    tournaments: 20,
    activePlayers: '3.2K+',
    totalPrize: '₹4,00,000',
    featured: true,
    order: 4
  },
  {
    id: 'pubgpc',
    name: 'PUBG PC',
    icon: '🎮',
    category: 'PC',
    description: 'Original battle royale experience',
    background: 'linear-gradient(135deg, #f39800 0%, #2c1810 100%)',
    backgroundImage: 'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=1920&h=1080&fit=crop&crop=center',
    logo: 'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=200&h=200&fit=crop&crop=center',
    tournaments: 8,
    activePlayers: '1.2K+',
    totalPrize: '₹2,50,000',
    order: 5
  },
  {
    id: 'mobilelegends',
    name: 'MOBILE LEGENDS',
    icon: '⚔️',
    category: 'Mobile',
    description: '5v5 MOBA battles on mobile',
    background: 'linear-gradient(135deg, #4a90e2 0%, #2c1810 100%)',
    backgroundImage: 'https://images.unsplash.com/photo-1556438064-2d7646166914?w=1920&h=1080&fit=crop&crop=center',
    logo: 'https://images.unsplash.com/photo-1556438064-2d7646166914?w=200&h=200&fit=crop&crop=center',
    tournaments: 10,
    activePlayers: '900+',
    totalPrize: '₹2,00,000',
    order: 6
  }
];

const seedGames = async () => {
  try {
    console.log('🎮 Seeding games data...');
    
    // Clear existing games
    await Game.deleteMany({});
    
    // Insert new games
    await Game.insertMany(gamesData);
    
    console.log('✅ Games seeded successfully!');
    console.log(`📊 Total games: ${gamesData.length}`);
    console.log(`🌟 Featured games: ${gamesData.filter(g => g.featured).length}`);
    
  } catch (error) {
    console.error('❌ Error seeding games:', error);
    throw error;
  }
};

module.exports = { seedGames, gamesData };