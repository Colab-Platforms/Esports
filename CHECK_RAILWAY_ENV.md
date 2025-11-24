# Railway Environment Variables Check

## Problem
MongoDB Atlas IP whitelist set hai but still timeout aa raha hai.

**This means: Railway doesn't have MONGODB_URI environment variable!**

## Solution: Add Environment Variables in Railway

### Step 1: Open Railway Dashboard
1. Go to: https://railway.app/dashboard
2. Click on your project: **web-production-77ca1**
3. Click on **"Variables"** tab (top menu)

### Step 2: Add These Variables

Click **"New Variable"** button and add each one:

#### Variable 1: MONGODB_URI
```
Name: MONGODB_URI
Value: mongodb+srv://colab_esports:qZgaDLfllrytAKqM@esports.zn4fbf9.mongodb.net/colab-esports
```

#### Variable 2: JWT_SECRET
```
Name: JWT_SECRET
Value: colab_developers_amish_chandan12124545
```

#### Variable 3: CLIENT_URL
```
Name: CLIENT_URL
Value: https://esports-62sh.vercel.app
```

#### Variable 4: NODE_ENV
```
Name: NODE_ENV
Value: production
```

#### Variable 5: PORT (Optional)
```
Name: PORT
Value: 5001
```

### Step 3: Save and Wait
- Railway will automatically redeploy after adding variables
- Wait 2-3 minutes for deployment to complete

### Step 4: Check Railway Logs
1. Go to Railway Dashboard
2. Click **"Deployments"** tab
3. Click on latest deployment
4. Click **"View Logs"**

**Look for:**
```
🔧 Environment Debug:
📍 PORT: 5001
📍 MONGODB_URI: Found ✅
📍 JWT_SECRET: Found ✅
🔗 Connecting to MongoDB...
🎮 MongoDB connected successfully ✅
📊 Database name: colab-esports
```

If you see "Missing" for MONGODB_URI, the variable is not set correctly.

### Step 5: Test Again (After 3 Minutes)
```powershell
# Test seed
Invoke-WebRequest -Uri "https://web-production-77ca1.up.railway.app/api/seed-database" -Method POST

# Test tournaments
Invoke-WebRequest -Uri "https://web-production-77ca1.up.railway.app/api/tournaments" -Method GET
```

## Common Mistakes

### Mistake 1: Wrong Variable Name
- Must be exactly: `MONGODB_URI` (not MONGO_URI or DATABASE_URL)
- Case sensitive!

### Mistake 2: Extra Spaces
- No spaces before or after the value
- Copy-paste carefully

### Mistake 3: Wrong Project
- Make sure you're adding variables to the correct Railway project
- Check project name: **web-production-77ca1**

### Mistake 4: Not Waiting
- Railway takes 2-3 minutes to redeploy
- Don't test immediately after adding variables

## Screenshot Guide

```
Railway Dashboard
├── Your Project (web-production-77ca1)
│   ├── Variables Tab (click here)
│   │   ├── New Variable (button)
│   │   │   ├── Variable Name: MONGODB_URI
│   │   │   └── Variable Value: mongodb+srv://...
│   │   └── Add (button)
│   └── Deployments Tab
│       └── View Logs (check for "MongoDB connected successfully")
```

## Alternative: Use Railway CLI

If web interface is not working, use CLI:

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Link to project
railway link

# Add variables
railway variables set MONGODB_URI="mongodb+srv://colab_esports:qZgaDLfllrytAKqM@esports.zn4fbf9.mongodb.net/colab-esports"
railway variables set JWT_SECRET="colab_developers_amish_chandan12124545"
railway variables set CLIENT_URL="https://esports-62sh.vercel.app"
railway variables set NODE_ENV="production"
```

## Verify Variables Are Set

After adding, verify in Railway dashboard:
1. Go to Variables tab
2. You should see all 4-5 variables listed
3. Values should be visible (or hidden with dots)

## Next Steps After Adding Variables

1. ✅ Wait 3 minutes for Railway to redeploy
2. ✅ Check Railway logs for "MongoDB connected successfully"
3. ✅ Test seed endpoint
4. ✅ Test tournaments endpoint
5. ✅ Open Vercel frontend and check if data loads
