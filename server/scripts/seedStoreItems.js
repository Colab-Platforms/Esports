const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const StoreItem = require('../models/StoreItem');

const storeItems = [
  // BGMI UC Packs
  {
    name: '60 UC',
    description: 'Get 60 UC for BGMI',
    category: 'uc',
    game: 'bgmi',
    price: 50,
    stock: -1,
    isActive: true,
    metadata: { uc: 60, featured: false, badge: null }
  },
  {
    name: '600 UC',
    description: 'Get 600 UC for BGMI - Best Value!',
    category: 'uc',
    game: 'bgmi',
    price: 400,
    stock: -1,
    isActive: true,
    metadata: { uc: 600, featured: true, badge: 'Best Value' }
  },
  {
    name: '1800 UC',
    description: 'Get 1800 UC for BGMI - Hot Deal!',
    category: 'uc',
    game: 'bgmi',
    price: 1000,
    stock: -1,
    isActive: true,
    metadata: { uc: 1800, featured: true, badge: 'Hot' }
  },
  {
    name: '3600 UC',
    description: 'Get 3600 UC for BGMI - Maximum Value',
    category: 'uc',
    game: 'bgmi',
    price: 1800,
    stock: -1,
    isActive: true,
    metadata: { uc: 3600, featured: false, badge: null }
  },
  // FreeFire Diamond Packs
  {
    name: '100 Diamonds',
    description: 'Get 100 Diamonds for Free Fire',
    category: 'uc',
    game: 'freefire',
    price: 50,
    stock: -1,
    isActive: true,
    metadata: { uc: 100, featured: false, badge: null }
  },
  {
    name: '500 Diamonds',
    description: 'Get 500 Diamonds for Free Fire - Best Value!',
    category: 'uc',
    game: 'freefire',
    price: 250,
    stock: -1,
    isActive: true,
    metadata: { uc: 500, featured: true, badge: 'Best Value' }
  },
  {
    name: '1000 Diamonds',
    description: 'Get 1000 Diamonds for Free Fire - Hot Deal!',
    category: 'uc',
    game: 'freefire',
    price: 450,
    stock: -1,
    isActive: true,
    metadata: { uc: 1000, featured: true, badge: 'Hot' }
  },
  // BGMI Cosmetics
  {
    name: 'Dragon Skin',
    description: 'Legendary BGMI weapon skin with dragon design',
    category: 'cosmetics',
    game: 'bgmi',
    price: 200,
    stock: -1,
    isActive: true,
    metadata: { type: 'Weapon Skin', featured: false, badge: null }
  },
  {
    name: 'Neon Skin',
    description: 'Futuristic neon BGMI weapon skin',
    category: 'cosmetics',
    game: 'bgmi',
    price: 250,
    stock: -1,
    isActive: true,
    metadata: { type: 'Weapon Skin', featured: true, badge: 'Best Value' }
  },
  // FreeFire Cosmetics
  {
    name: 'FF Elite Avatar',
    description: 'Premium avatar frame for Free Fire profile',
    category: 'cosmetics',
    game: 'freefire',
    price: 150,
    stock: -1,
    isActive: true,
    metadata: { type: 'Avatar Frame', featured: true, badge: 'Hot' }
  },
  {
    name: 'FF Pro Avatar',
    description: 'Professional avatar frame for Free Fire esports players',
    category: 'cosmetics',
    game: 'freefire',
    price: 180,
    stock: -1,
    isActive: true,
    metadata: { type: 'Avatar Frame', featured: false, badge: null }
  },
  // Platform-wide Passes
  {
    name: 'Season Pass',
    description: 'Unlock all season rewards and exclusive items across all games',
    category: 'passes',
    game: 'all',
    price: 500,
    stock: -1,
    isActive: true,
    metadata: { type: 'Season Pass', featured: true, badge: 'Hot' }
  },
  {
    name: 'Tournament Pass',
    description: 'Get exclusive tournament rewards and bonuses for all games',
    category: 'passes',
    game: 'all',
    price: 300,
    stock: -1,
    isActive: true,
    metadata: { type: 'Tournament Pass', featured: false, badge: null }
  }
];

async function seedStoreItems() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/colab-esports', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('✅ Connected to MongoDB');

    // Clear existing items
    await StoreItem.deleteMany({});
    console.log('🗑️  Cleared existing store items');

    // Insert new items
    const inserted = await StoreItem.insertMany(storeItems);
    console.log(`✅ Seeded ${inserted.length} store items`);

    // Display summary
    const ucCount = await StoreItem.countDocuments({ category: 'uc' });
    const cosmeticsCount = await StoreItem.countDocuments({ category: 'cosmetics' });
    const passesCount = await StoreItem.countDocuments({ category: 'passes' });

    console.log('\n📊 Store Items Summary:');
    console.log(`  💎 UC Packs: ${ucCount}`);
    console.log(`  🎨 Cosmetics: ${cosmeticsCount}`);
    console.log(`  🎫 Game Passes: ${passesCount}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding store items:', error);
    process.exit(1);
  }
}

seedStoreItems();
