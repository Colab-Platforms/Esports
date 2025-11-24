# Railway Backend Debug Checklist

## Current Error Analysis

### Errors Seen:
1. **500 Internal Server Error** on `/api/tournaments` and `/api/stats`
2. **HTML response instead of JSON** - This means Express error handler is returning HTML
3. **"Cannot read properties of undefined (reading 'tournaments')"** - API response structure is wrong

### Root Cause:
Backend is crashing or database connection is failing on Railway.

## Step-by-Step Debug Process

### Step 1: Check Railway Logs
1. Go to Railway Dashboard: https://railway.app/dashboard
2. Click on your project
3. Click on "Deployments" tab
4. Click on latest deployment
5. Check logs for:
   - ❌ MongoDB connection errors
   - ❌ Missing environment variables
   - ❌ Route errors
   - ✅ "🎮 MongoDB connected successfully"

### Step 2: Verify Environment Variables on Railway
Go to Railway → Your Project → Variables and ensure these are set:

**Required Variables:**
```
MONGODB_URI=mongodb+srv://colab_esports:qZgaDLfllrytAKqM@esports.zn4fbf9.mongodb.net/colab-esports
JWT_SECRET=colab_developers_amish_chandan12124545
CLIENT_URL=https://esports-62sh.vercel.app
NODE_ENV=production
PORT=5001
```

**Optional but Recommended:**
```
JWT_EXPIRE=7d
BCRYPT_ROUNDS=12
```

### Step 3: Test Railway API Directly

Open terminal and run:

```bash
# Test health endpoint
curl https://web-production-77ca1.up.railway.app/api/health

# Test stats endpoint
curl https://web-production-77ca1.up.railway.app/api/tournaments/stats

# Test tournaments endpoint
curl https://web-production-77ca1.up.railway.app/api/tournaments
```

**Expected Response:**
```json
{
  "success": true,
  "data": { ... },
  "message": "...",
  "timestamp": "..."
}
```

**If you get HTML or 500 error:**
- Backend is crashing
- Check Railway logs immediately

### Step 4: Check MongoDB Connection

**Test MongoDB URI:**
```bash
# Use MongoDB Compass or mongosh to test connection
mongosh "mongodb+srv://colab_esports:qZgaDLfllrytAKqM@esports.zn4fbf9.mongodb.net/colab-esports"
```

**Common MongoDB Issues:**
- ❌ IP whitelist not set to 0.0.0.0/0 (allow all)
- ❌ Wrong password
- ❌ Database name incorrect
- ❌ Network access restricted

### Step 5: Seed Database (If Empty)

If database is empty, seed it:

```bash
# Using curl
curl -X POST https://web-production-77ca1.up.railway.app/api/seed-database
```

Or visit in browser:
```
https://web-production-77ca1.up.railway.app/api/seed-database
```

This will create sample users, tournaments, and leaderboard data.

## Common Issues & Solutions

### Issue 1: MongoDB Connection Failed
**Symptoms:**
- 500 errors on all API calls
- Logs show "MongoDB connection error"

**Solution:**
1. Go to MongoDB Atlas
2. Network Access → Add IP Address → Allow Access from Anywhere (0.0.0.0/0)
3. Database Access → Verify user exists with correct password
4. Redeploy Railway

### Issue 2: Environment Variables Missing
**Symptoms:**
- Logs show "Missing" for MONGODB_URI or JWT_SECRET
- 500 errors on protected routes

**Solution:**
1. Add all required environment variables in Railway
2. Railway will auto-redeploy
3. Check logs again

### Issue 3: Routes Not Found (404)
**Symptoms:**
- 404 errors instead of 500
- "Cannot GET /api/tournaments"

**Solution:**
1. Check if `server/index.js` has route imports:
   ```javascript
   app.use('/api/tournaments', require('./routes/tournaments'));
   ```
2. Verify files exist in `server/routes/` directory
3. Redeploy

### Issue 4: CORS Errors
**Symptoms:**
- "CORS policy" error in browser console
- API works in curl but not in browser

**Solution:**
Already fixed in `server/index.js` - just redeploy:
```bash
git add .
git commit -m "fix: CORS for Vercel"
git push
```

### Issue 5: Database Empty
**Symptoms:**
- API works but returns empty arrays
- No tournaments or users

**Solution:**
Seed the database:
```bash
curl -X POST https://web-production-77ca1.up.railway.app/api/seed-database
```

## Quick Fix Commands

```bash
# 1. Commit and push changes
git add .
git commit -m "fix: backend configuration"
git push

# 2. Test health endpoint
curl https://web-production-77ca1.up.railway.app/api/health

# 3. Seed database if needed
curl -X POST https://web-production-77ca1.up.railway.app/api/seed-database

# 4. Test tournaments
curl https://web-production-77ca1.up.railway.app/api/tournaments

# 5. Test stats
curl https://web-production-77ca1.up.railway.app/api/tournaments/stats
```

## What to Check in Railway Logs

Look for these messages:

**✅ Good Signs:**
```
🔧 Environment Debug:
📍 PORT: 5001
📍 MONGODB_URI: Found
📍 JWT_SECRET: Found
🔗 Connecting to MongoDB...
🎮 MongoDB connected successfully
📊 Database name: colab-esports
```

**❌ Bad Signs:**
```
❌ MongoDB connection error
📍 MONGODB_URI: Missing
📍 JWT_SECRET: Missing
Error: connect ECONNREFUSED
UnhandledPromiseRejectionWarning
```

## Next Steps After Debugging

1. ✅ Verify Railway logs show successful MongoDB connection
2. ✅ Test all API endpoints with curl
3. ✅ Seed database if empty
4. ✅ Redeploy Vercel frontend
5. ✅ Test in browser with console open
6. ✅ Verify no CORS errors
7. ✅ Check data loading properly

## Emergency Rollback

If nothing works, rollback to previous deployment:
1. Go to Railway → Deployments
2. Find last working deployment
3. Click "..." → "Redeploy"
