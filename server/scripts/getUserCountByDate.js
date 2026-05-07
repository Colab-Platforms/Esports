const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.production' });

const User = require('../models/User');

async function getUserCountByDate() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Date range: 19 Feb 2026 to 28 Feb 2026 (inclusive)
    const startDate = new Date('2026-04-01T00:00:00Z');
    const endDate = new Date('2026-04-16T23:59:59Z');

    console.log(`\n📊 User Count Report`);
    console.log(`📅 Date Range: 01 Jan 2026 to 16 Apr 2026`);
    console.log('─'.repeat(50));

    // Total users in date range
    const totalUsers = await User.countDocuments({
      createdAt: { $gte: startDate, $lte: endDate }
    });

    console.log(`\n✅ Total New Users: ${totalUsers}`);

    // Daily breakdown
    // const dailyBreakdown = await User.aggregate([
    //   {
    //     $match: {
    //       createdAt: { $gte: startDate, $lte: endDate }
    //     }
    //   },
    //   {
    //     $group: {
    //       _id: {
    //         $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
    //       },
    //       count: { $sum: 1 }
    //     }
    //   },
    //   { $sort: { _id: 1 } }
    // ]);

    console.log(`\n📈 Daily Breakdown:`);
    // dailyBreakdown.forEach(item => {
    //   console.log(`   ${item._id}: ${item.count} users`);
    // });

    await mongoose.connection.close();
    console.log('\n✅ Done!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

getUserCountByDate();
