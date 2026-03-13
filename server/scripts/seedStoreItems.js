const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const StoreItem = require('../models/StoreItem');

const storeItems = [
  // UC Packs
  {
    name: '60 UC',
    description: 'Get 60 UC for your favorite games',
    category: 'uc',
    price: 50,
    stock: -1,
    isActive: true,
    metadata: {
      uc: 60,
      featured: false,
      badge: null
    }
  },
  {
    name: '600 UC',
    description: 'Get 600 UC - Best Value!',
    category: 'uc',
    price: 400,
    stock: -1,
    isActive: true,
    metadata: {
      uc: 600,
      featured: true,
      badge: 'Best Value'
    }
  },
  {
    name: '1800 UC',
    description: 'Get 1800 UC - Hot Deal!',
    category: 'uc',
    price: 1000,
    stock: -1,
    isActive: true,
    metadata: {
      uc: 1800,
      featured: true,
      badge: 'Hot'
    }
  },
  {
    name: '3600 UC',
    description: 'Get 3600 UC - Maximum Value',
    category: 'uc',
    price: 1800,
    stock: -1,
    isActive: true,
    metadata: {
      uc: 3600,
      featured: false,
      badge: null
    }
  },
  // Cosmetics
  {
    name: 'Dragon Skin',
    description: 'Legendary weapon skin with dragon design',
    category: 'cosmetics',
    price: 200,
    stock: -1,
    isActive: true,
    metadata: {
      type: 'Weapon Skin',
      featured: false,
      badge: null
    }
  },
  {
    name: 'Elite Avatar',
    description: 'Premium avatar frame for your profile',
    category: 'cosmetics',
    price: 150,
    stock: -1,
    isActive: true,
    metadata: {
      type: 'Avatar Frame',
      featured: true,
      badge: 'Hot'
    }
  },
  {
    name: 'Neon Skin',
    description: 'Futuristic neon weapon skin',
    category: 'cosmetics',
    price: 250,
    stock: -1,
    isActive: true,
    metadata: {
      type: 'Weapon Skin',
      featured: true,
      badge: 'Best Value'
    }
  },
  {
    name: 'Pro Avatar',
    description: 'Professional avatar frame for esports players',
    category: 'cosmetics',
    price: 180,
    stock: -1,
    isActive: true,
    metadata: {
      type: 'Avatar Frame',
      featured: false,
      badge: null
    }
  },
  // Game Passes
  {
    name: 'Season Pass',
    description: 'Unlock all season rewards and exclusive items',
    category: 'passes',
    price: 500,
    stock: -1,
    isActive: true,
    metadata: {
      type: 'Season Pass',
      featured: true,
      badge: 'Hot'
    }
  },
  {
    name: 'Tournament Pass',
    description: 'Get exclusive tournament rewards and bonuses',
    category: 'passes',
    price: 300,
    stock: -1,
    isActive: true,
    metadata: {
      type: 'Tournament Pass',
      featured: false,
      badge: null
    }
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
