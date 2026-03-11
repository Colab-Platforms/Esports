const mongoose = require('mongoose');
const { CoinConfig } = require('../models/CoinConfig');

// Initialize welcome bonus configuration
async function initWelcomeBonus() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/colab-esports');
    console.log('✅ Connected to MongoDB');

    // Check if welcome bonus config already exists
    const existingConfig = await CoinConfig.findOne({ key: 'welcome_bonus' });
    
    if (existingConfig) {
      console.log('🎁 Welcome bonus config already exists:', existingConfig);
      console.log(`Current welcome bonus amount: ${existingConfig.value} coins`);
    } else {
      // Create welcome bonus config
      const welcomeBonusConfig = new CoinConfig({
        key: 'welcome_bonus',
        value: 100, // Default 100 coins
        description: 'Welcome bonus coins given to new users upon registration',
        category: 'bonus'
      });

      await welcomeBonusConfig.save();
      console.log('✅ Welcome bonus config created successfully!');
      console.log(`Welcome bonus amount set to: ${welcomeBonusConfig.value} coins`);
    }

    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');

  } catch (error) {
    console.error('❌ Error initializing welcome bonus:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  initWelcomeBonus();
}

module.exports = initWelcomeBonus;