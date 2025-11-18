# Install Express Session - REQUIRED! ⚠️

## Problem
Steam OAuth failing with `?error=missing_user` because express-session is not installed.

## Solution
Install express-session package in server directory.

## Steps:

### 1. Open Terminal in Server Directory
```bash
cd server
```

### 2. Install express-session
```bash
npm install express-session
```

### 3. Restart Server
```bash
# Stop current server (Ctrl+C)
# Then start again
nodemon server.js
```

## What Was Fixed

### Files Modified:
1. `server/index.js`
   - Added express-session import
   - Added session middleware configuration
   - Added passport.session() middleware

2. `server/routes/steam.js`
   - Added passport.serializeUser
   - Added passport.deserializeUser
   - Session now properly stores userId

## How It Works Now

### Before (Broken):
```
1. User clicks "Connect Steam"
2. Redirect with ?state=userId
3. Steam OAuth
4. Callback - NO SESSION
5. ❌ userId lost
6. Error: missing_user
```

### After (Fixed):
```
1. User clicks "Connect Steam"
2. Store userId in session
3. Steam OAuth
4. Callback - READ FROM SESSION
5. ✅ userId retrieved
6. Update user profile
7. Redirect to tournament
```

## Session Configuration

```javascript
app.use(session({
  secret: process.env.JWT_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // true in production with HTTPS
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));
```

## Testing

After installing and restarting:

1. Go to CS2 tournament
2. Click "JOIN NOW"
3. Click "Connect Steam" in modal
4. Login to Steam
5. ✅ Should redirect back to tournament (not /games?error=missing_user)
6. ✅ Steam ID should be saved in user profile

## Important Notes

- express-session is REQUIRED for Steam OAuth
- Session stores userId temporarily during OAuth flow
- Without it, userId is lost after Steam redirect
- This is a server-side dependency, not client-side

## If Still Getting Error

1. Make sure server restarted after npm install
2. Check server logs for session errors
3. Clear browser cookies
4. Try Steam login again

---

**INSTALL NOW:**
```bash
cd server
npm install express-session
```

Then restart server!
