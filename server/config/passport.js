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
      console.log(' Callback URL used:', `${process.env.SERVER_URL}/api/auth/google/callback`);
      
      // Validate profile data
      if (!profile.emails || !profile.emails[0] || !profile.emails[0].value) {
        return done(new Error('No email provided by Google'), null);
      }
      
      const email = profile.emails[0].value;
      console.log('📧 Email:', email);
      
      // Check if user already exists with this Google ID
      console.log('🔎 Checking for existing Google ID...');
      let user = await User.findOne({ 'socialAccounts.google.id': profile.id });
      
      if (user) {
        console.log('✅ Existing Google user found:', user.username);
        return done(null, user);
      }
      
      console.log('🔎 Checking for existing email...');
      // Use direct MongoDB query to avoid Mongoose validation issues
      const userDoc = await User.collection.findOne({ email: email });
      
      if (userDoc) {
        console.log('🔗 User with email exists, fixing data and linking Google account...');
        
        // Direct MongoDB update to fix the schema issue
        await User.collection.updateOne(
          { _id: userDoc._id },
          { 
            $set: { 
              'gameIds.bgmi': '',
              'socialAccounts.google': {
                id: profile.id,
                email: email,
                name: profile.displayName,
                picture: profile.photos?.[0]?.value || '',
                isConnected: true,
                connectedAt: new Date()
              }
            }
          }
        );
        
        // Now fetch the clean user with Mongoose
        const cleanUser = await User.findById(userDoc._id);
        console.log('✅ Google account linked and data fixed for user:', cleanUser.username);
        return done(null, cleanUser);
      }
      
      console.log('👤 Creating new user...');
      
      // Generate unique username
      let baseUsername = profile.displayName.replace(/\s+/g, '').toLowerCase();
      let username = baseUsername;
      let counter = 1;
      
      // Ensure username uniqueness
      while (await User.findOne({ username: username })) {
        counter++;
        username = baseUsername + counter;
      }
      
      console.log('� New username:', username);
      
      const newUser = new User({
        username: username,
        fullName: profile.displayName,
        email: email,
        avatarUrl: profile.photos?.[0]?.value || '',
        socialAccounts: {
          google: {
            id: profile.id,
            email: email,
            name: profile.displayName,
            picture: profile.photos?.[0]?.value || '',
            isConnected: true,
            connectedAt: new Date()
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