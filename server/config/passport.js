const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const SteamStrategy = require('passport-steam').Strategy;
const User = require('../models/User');

// Serialize user for session
passport.serializeUser((user, done) => {
  done(null, user._id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

// Google OAuth Strategy
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && 
    process.env.GOOGLE_CLIENT_ID !== 'your-google-client-id' && 
    process.env.GOOGLE_CLIENT_SECRET !== 'your-google-client-secret') {
  
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: `${process.env.SERVER_URL}/api/auth/google/callback`
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      console.log('🔍 Google OAuth Profile:', profile);
      console.log('📧 Email:', profile.emails[0].value);
      
      // Check if user already exists with this Google ID
      console.log('🔎 Checking for existing Google ID...');
      let user = await User.findOne({ 'socialAccounts.google.id': profile.id });
      
      if (user) {
        console.log('✅ Existing Google user found:', user.username);
        return done(null, user);
      }
      
      console.log('🔎 Checking for existing email...');
      // Check if user exists with same email
      user = await User.findOne({ email: profile.emails[0].value });
      
      if (user) {
        console.log('🔗 User with email exists, linking Google account...');
        // Link Google account to existing user
        user.socialAccounts.google = {
          id: profile.id,
          email: profile.emails[0].value,
          name: profile.displayName,
          picture: profile.photos[0].value
        };
        await user.save();
        console.log('✅ Google account linked to existing user:', user.username);
        return done(null, user);
      }
      
      console.log('👤 Creating new user...');
      // Create new user
      const username = profile.displayName.replace(/\s+/g, '').toLowerCase() + Math.floor(Math.random() * 1000);
      console.log('📝 New username:', username);
      
      const newUser = new User({
        username: username,
        email: profile.emails[0].value,
        avatarUrl: profile.photos[0].value,
        socialAccounts: {
          google: {
            id: profile.id,
            email: profile.emails[0].value,
            name: profile.displayName,
            picture: profile.photos[0].value
          }
        },
        isEmailVerified: true, // Google emails are verified
        authProvider: 'google'
        // Don't set phone field for OAuth users - let it be undefined
      });
      
      console.log('💾 Saving new user to database...');
      await newUser.save();
      console.log('🎉 New Google user created:', newUser.username, 'ID:', newUser._id);
      done(null, newUser);
      
    } catch (error) {
      console.error('❌ Google OAuth error:', error);
      console.error('❌ Error details:', error.message);
      console.error('❌ Error stack:', error.stack);
      done(error, null);
    }
  }));
} else {
  console.warn('⚠️ Google OAuth not configured - missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET');
}

// Steam Strategy (already exists but updating)
passport.use(new SteamStrategy({
  returnURL: process.env.STEAM_RETURN_URL || 'http://localhost:5001/api/auth/steam/return',
  realm: process.env.STEAM_REALM || 'http://localhost:5001/',
  apiKey: process.env.STEAM_API_KEY
}, async (identifier, profile, done) => {
  try {
    console.log('🔍 Steam Profile:', profile);
    
    // Extract Steam ID from identifier
    const steamId = identifier.split('/').pop();
    
    // Check if user already exists with this Steam ID
    let user = await User.findOne({ 'steamProfile.steamId': steamId });
    
    if (user) {
      console.log('✅ Existing Steam user found:', user.username);
      return done(null, user);
    }
    
    // Create new user or link to existing user
    // For now, create new user - you can modify this logic
    const newUser = new User({
      username: profile.displayName.replace(/\s+/g, '').toLowerCase() + Math.floor(Math.random() * 1000),
      email: `${steamId}@steam.local`, // Temporary email
      avatarUrl: profile.photos[2].value, // Full size avatar
      steamProfile: {
        steamId: steamId,
        displayName: profile.displayName,
        profileUrl: profile._json.profileurl,
        avatar: profile.photos[2].value,
        country: profile._json.loccountrycode,
        state: profile._json.locstatecode,
        realName: profile._json.realname
      },
      authProvider: 'steam'
      // Don't set phone field for OAuth users - let it be undefined
    });
    
    await newUser.save();
    console.log('🎉 New Steam user created:', newUser.username);
    done(null, newUser);
    
  } catch (error) {
    console.error('❌ Steam OAuth error:', error);
    done(error, null);
  }
}));

module.exports = passport;