const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const Server = require('../models/Server');
const Testimonial = require('../models/Testimonial');
const User = require('../models/User');

const seedData = async () => {
  try {
    console.log('🌱 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/colab-esports');
    console.log('✅ Connected to MongoDB');

    // Find or create admin user for testimonials
    let adminUser = await User.findOne({ role: 'admin' });
    if (!adminUser) {
      console.log('⚠️ No admin user found, creating default admin...');
      adminUser = new User({
        username: 'admin',
        email: 'admin@colabesports.com',
        password: 'admin123', // This will be hashed
        role: 'admin',
        isVerified: true
      });
      await adminUser.save();
      console.log('✅ Default admin user created');
    }

    // Clear existing data
    console.log('🧹 Clearing existing servers and testimonials...');
    await Server.deleteMany({});
    await Testimonial.deleteMany({});

    // Seed CS2 Servers (only 2 Mumbai servers as per current design)
    console.log('🖥️ Seeding CS2 servers...');
    const servers = [
      {
        name: 'Mumbai Server #1',
        gameType: 'cs2',
        region: 'mumbai',
        ip: '103.97.126.45',
        port: '27015',
        maxPlayers: 10,
        currentPlayers: 8,
        status: 'active',
        map: 'de_dust2',
        ping: '12ms',
        isPublic: true,
        description: 'Primary Mumbai CS2 server with auto stats tracking'
      },
      {
        name: 'Mumbai Server #2',
        gameType: 'cs2',
        region: 'mumbai',
        ip: '103.97.126.46',
        port: '27015',
        maxPlayers: 10,
        currentPlayers: 10,
        status: 'full',
        map: 'de_mirage',
        ping: '15ms',
        isPublic: true,
        description: 'Secondary Mumbai CS2 server with auto stats tracking'
      }
    ];

    const createdServers = await Server.insertMany(servers);
    console.log(`✅ Created ${createdServers.length} servers`);

    // Seed Testimonials
    console.log('💬 Seeding testimonials...');
    const testimonials = [
      {
        name: 'Rahul K.',
        username: 'rahul_cs2_pro',
        gameType: 'cs2',
        gameTitle: 'CS2 Player',
        text: 'Best platform for competitive CS2 in India. Auto stats tracking is amazing!',
        rating: 5,
        avatar: '',
        isVerified: true,
        isActive: true,
        displayOrder: 1,
        createdBy: adminUser._id
      },
      {
        name: 'Priya S.',
        username: 'priya_bgmi_queen',
        gameType: 'bgmi',
        gameTitle: 'BGMI Player',
        text: 'Love the free tournaments and smooth registration process. Highly recommended!',
        rating: 5,
        avatar: '',
        isVerified: true,
        isActive: true,
        displayOrder: 2,
        createdBy: adminUser._id
      },
      {
        name: 'Arjun M.',
        username: 'arjun_pro_gamer',
        gameType: 'valorant',
        gameTitle: 'Pro Gamer',
        text: 'Finally a platform that takes esports seriously. Great prizes and fair play.',
        rating: 5,
        avatar: '',
        isVerified: true,
        isActive: true,
        displayOrder: 3,
        createdBy: adminUser._id
      },
      {
        name: 'Sneha R.',
        username: 'sneha_gamer_girl',
        gameType: 'bgmi',
        gameTitle: 'BGMI Enthusiast',
        text: 'Amazing community and great tournaments. The WhatsApp integration is so convenient!',
        rating: 5,
        avatar: '',
        isVerified: true,
        isActive: true,
        displayOrder: 4,
        createdBy: adminUser._id
      },
      {
        name: 'Vikash T.',
        username: 'vikash_cs2_legend',
        gameType: 'cs2',
        gameTitle: 'CS2 Legend',
        text: 'Mumbai servers have excellent ping and the leaderboard system is top-notch!',
        rating: 5,
        avatar: '',
        isVerified: true,
        isActive: true,
        displayOrder: 5,
        createdBy: adminUser._id
      },
      {
        name: 'Ananya P.',
        username: 'ananya_mobile_pro',
        gameType: 'freefire',
        gameTitle: 'Mobile Gaming Pro',
        text: 'Excited for Free Fire tournaments! The platform looks very promising.',
        rating: 5,
        avatar: '',
        isVerified: false,
        isActive: true,
        displayOrder: 6,
        createdBy: adminUser._id
      }
    ];

    const createdTestimonials = await Testimonial.insertMany(testimonials);
    console.log(`✅ Created ${createdTestimonials.length} testimonials`);

    console.log('🎉 Seed data created successfully!');
    console.log('📊 Summary:');
    console.log(`   - Servers: ${createdServers.length}`);
    console.log(`   - Testimonials: ${createdTestimonials.length}`);
    console.log('');
    console.log('🔗 API Endpoints:');
    console.log('   - GET /api/servers?gameType=cs2');
    console.log('   - GET /api/testimonials');
    console.log('   - GET /api/testimonials?gameType=cs2');
    console.log('   - GET /api/testimonials?gameType=bgmi');

  } catch (error) {
    console.error('❌ Seed error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
};

// Run the seed function
seedData();