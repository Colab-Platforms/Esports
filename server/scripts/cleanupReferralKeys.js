const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load env vars
dotenv.config({ path: path.join(__dirname, '../../.env') });

const cleanup = async () => {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected!');

    const { CoinConfig } = require('../models/CoinConfig');

    const keysToRemove = ['referral_reward', 'referee_referral_bonus'];
    
    console.log(`Removing redundant keys: ${keysToRemove.join(', ')}...`);
    const result = await CoinConfig.deleteMany({ key: { $in: keysToRemove } });
    
    console.log(`Successfully removed ${result.deletedCount} redundant keys.`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error during cleanup:', error);
    process.exit(1);
  }
};

cleanup();
