/**
 * Cleanup Script: Remove Base64 Images from Database
 * 
 * This script finds all site images with base64 URLs and either:
 * 1. Removes them (recommended - designer can re-upload to Cloudinary)
 * 2. Marks them for manual review
 * 
 * Run: node server/scripts/cleanupBase64Images.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const SiteImage = require('../models/SiteImage');

async function cleanupBase64Images() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/colab-esports');
    console.log('✅ Connected to MongoDB');

    // Find all images with base64 URLs
    const allImages = await SiteImage.find();
    
    let base64Count = 0;
    let cleanedCount = 0;
    const base64Images = [];

    for (const image of allImages) {
      let hasBase64 = false;
      
      // Check main imageUrl
      if (image.imageUrl && image.imageUrl.startsWith('data:image')) {
        hasBase64 = true;
        console.log(`❌ Found base64 in main imageUrl: ${image.key}`);
      }

      // Check responsive URLs
      if (image.responsiveUrls) {
        for (const [device, url] of Object.entries(image.responsiveUrls)) {
          if (url && url.startsWith('data:image')) {
            hasBase64 = true;
            console.log(`❌ Found base64 in ${device} URL: ${image.key}`);
          }
        }
      }

      if (hasBase64) {
        base64Count++;
        base64Images.push({
          key: image.key,
          name: image.name,
          category: image.category
        });
      }
    }

    console.log('\n📊 Summary:');
    console.log(`Total images: ${allImages.length}`);
    console.log(`Images with base64: ${base64Count}`);

    if (base64Count === 0) {
      console.log('✅ No base64 images found! Database is clean.');
      await mongoose.connection.close();
      return;
    }

    console.log('\n🗑️ Base64 images found:');
    base64Images.forEach(img => {
      console.log(`  - ${img.key} (${img.name}) [${img.category}]`);
    });

    // Ask for confirmation
    console.log('\n⚠️ CLEANUP OPTIONS:');
    console.log('1. Delete all base64 images (recommended - designer can re-upload)');
    console.log('2. Clear only base64 URLs but keep records');
    console.log('3. Exit without changes');
    
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });

    readline.question('\nEnter option (1/2/3): ', async (answer) => {
      if (answer === '1') {
        // Delete all base64 images
        for (const imgInfo of base64Images) {
          await SiteImage.deleteOne({ key: imgInfo.key });
          cleanedCount++;
          console.log(`🗑️ Deleted: ${imgInfo.key}`);
        }
        console.log(`\n✅ Deleted ${cleanedCount} base64 images`);
        console.log('💡 Designer can now re-upload these images to Cloudinary via admin panel');
        
      } else if (answer === '2') {
        // Clear base64 URLs but keep records
        for (const imgInfo of base64Images) {
          const image = await SiteImage.findOne({ key: imgInfo.key });
          
          // Clear main URL if base64
          if (image.imageUrl && image.imageUrl.startsWith('data:image')) {
            image.imageUrl = '';
          }
          
          // Clear responsive URLs if base64
          if (image.responsiveUrls) {
            for (const [device, url] of Object.entries(image.responsiveUrls)) {
              if (url && url.startsWith('data:image')) {
                image.responsiveUrls[device] = '';
              }
            }
          }
          
          await image.save();
          cleanedCount++;
          console.log(`🧹 Cleaned URLs: ${imgInfo.key}`);
        }
        console.log(`\n✅ Cleaned ${cleanedCount} image records`);
        console.log('💡 Records kept but URLs cleared - designer can re-upload');
        
      } else {
        console.log('❌ No changes made');
      }

      readline.close();
      await mongoose.connection.close();
      console.log('\n👋 Done!');
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

// Run cleanup
cleanupBase64Images();
