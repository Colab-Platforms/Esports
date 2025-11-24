# 🚨 URGENT FIX - Database Connection Issue

## Current Problem
```
"Operation `users.deleteMany()` buffering timed out after 10000ms"
```

Backend is running but **CANNOT connect to MongoDB Atlas**.

## Two Possible Causes:

### Cause 1: MongoDB Atlas IP Whitelist Not Set ❌
### Cause 2: Railway Missing MONGODB_URI Environment Variable ❌

---

## FIX 1: MongoDB Atlas IP Whitelist (DO THIS FIRST!)

### Step-by-Step:

1. **Open MongoDB Atlas:**
   - Go to: https://cloud.mongodb.com/
   - Login with your account

2. **Select Your Project:**
   - Make sure you're in the correct project (esports cluster)

3. **Go to Network Access:**
   - Click **"Network Access"** in the left sidebar
   - You should see a list of IP addresses

4. **Add IP Address:**
   - Click **"ADD IP ADDRESS"** button (green button)
   - A popup will appear

5. **Allow Access from Anywhere:**
   - Click **"ALLOW ACCESS FROM ANYWHERE"** button
   - This will automatically fill: `0.0.0.0/0`
   - Add a comment: "Railway Production"
   - Click **"Confirm"**

6. **Wait 2-3 Minutes:**
   - MongoDB takes time to propagate changes
   - Don't test immediately!

### Screenshot Guide:
```
MongoDB Atlas Dashboard
├── Left Sidebar
│   └── Network Access (click here)
│       └── ADD IP ADDRESS (green button)
│           └── ALLOW ACCESS FROM ANYWHERE (click this)
│               └── Confirm
```

---

## FIX 2: Railway Environment Variables

### Step-by-Step:

1. **Open Railway Dashboard:**
   - Go to: https://railway.app/dashboard
   - Click on your project

2. **Go to Variables Tab:**
   - Click on **"Variables"** tab at the top

3. **Add These Variables:**

Click **"New Variable"** and add each one:

```
Variable Name: MONGODB_URI
Value: mongodb+srv://colab_esports:qZgaDLfllrytAKqM@esports.zn4fbf9.mongodb.net/colab-esports
```

```
Variable Name: JWT_SECRET
Value: colab_developers_amish_chandan12124545
```

```
Variable Name: CLIENT_URL
Value: https://esports-62sh.vercel.app
```

```
Variable Name: NODE_ENV
Value: production
```

```
Variable Name: PORT
Value: 5001
```

4. **Save and Wait:**
   - Railway will automatically redeploy
   - Wait 2-3 minutes for deployment

---

## Test After Fixes (Wait 3-5 Minutes!)

### Test 1: Health Check
```powershell
Invoke-WebRequest -Uri "https://web-production-77ca1.up.railway.app/api/health" -Method GET
```

**Expected:** Status 200 OK

### Test 2: Seed Database
```powershell
Invoke-WebRequest -Uri "https://web-production-77ca1.up.railway.app/api/seed-database" -Method POST
```

**Expected:** 
```json
{
  "success": true,
  "data": {
    "users": 6,
    "tournaments": 7,
    "leaderboardEntries": 54
  }
}
```

### Test 3: Get Tournaments
```powershell
Invoke-WebRequest -Uri "https://web-production-77ca1.up.railway.app/api/tournaments" -Method GET
```

**Expected:** List of tournaments

### Test 4: Get Stats
```powershell
Invoke-WebRequest -Uri "https://web-production-77ca1.up.railway.app/api/tournaments/stats" -Method GET
```

**Expected:** Platform statistics

---

## Check Railway Logs

1. Go to Railway Dashboard
2. Click on your project
3. Click **"Deployments"** tab
4. Click on latest deployment
5. Click **"View Logs"**

### Look for These Messages:

**✅ GOOD (What you want to see):**
```
🔧 Environment Debug:
📍 PORT: 5001
📍 MONGODB_URI: Found
📍 JWT_SECRET: Found
🔗 Connecting to MongoDB...
🎮 MongoDB connected successfully
📊 Database name: colab-esports
```

**❌ BAD (Current problem):**
```
📍 MONGODB_URI: Missing
❌ MongoDB connection error
MongooseServerSelectionError: connect ETIMEDOUT
```

---

## If Still Not Working After Both Fixes:

### Option 1: Check MongoDB Atlas Cluster Status
1. Go to MongoDB Atlas
2. Click on "Database" in left sidebar
3. Make sure cluster is **RUNNING** (not paused)
4. If paused, click "Resume"

### Option 2: Verify Database User
1. Go to MongoDB Atlas
2. Click "Database Access" in left sidebar
3. Verify user `colab_esports` exists
4. If not, create it with password: `qZgaDLfllrytAKqM`
5. Give it "Read and write to any database" permission

### Option 3: Test MongoDB Connection Locally
```powershell
# Install mongosh if not installed
# Then test connection:
mongosh "mongodb+srv://colab_esports:qZgaDLfllrytAKqM@esports.zn4fbf9.mongodb.net/colab-esports"
```

If this fails, your MongoDB credentials are wrong.

---

## Quick Checklist

- [ ] MongoDB Atlas → Network Access → 0.0.0.0/0 added
- [ ] Waited 2-3 minutes after adding IP
- [ ] Railway → Variables → MONGODB_URI added
- [ ] Railway → Variables → JWT_SECRET added
- [ ] Railway → Variables → CLIENT_URL added
- [ ] Railway → Variables → NODE_ENV=production added
- [ ] Waited 2-3 minutes for Railway redeploy
- [ ] Checked Railway logs for "MongoDB connected successfully"
- [ ] Tested seed endpoint
- [ ] Tested tournaments endpoint
- [ ] Tested stats endpoint
- [ ] Opened Vercel frontend and checked browser console

---

## Final Test Commands (Run After All Fixes)

```powershell
# 1. Health
$health = Invoke-WebRequest -Uri "https://web-production-77ca1.up.railway.app/api/health"
Write-Host "Health Status:" $health.StatusCode

# 2. Seed (only run once!)
$seed = Invoke-WebRequest -Uri "https://web-production-77ca1.up.railway.app/api/seed-database" -Method POST
$seed.Content

# 3. Tournaments
$tournaments = Invoke-WebRequest -Uri "https://web-production-77ca1.up.railway.app/api/tournaments"
Write-Host "Tournaments Status:" $tournaments.StatusCode

# 4. Stats
$stats = Invoke-WebRequest -Uri "https://web-production-77ca1.up.railway.app/api/tournaments/stats"
Write-Host "Stats Status:" $stats.StatusCode
```

All should return **Status 200** after fixes!

---

## Contact Points

If still not working after ALL these steps:
1. Share Railway logs (copy-paste full logs)
2. Share MongoDB Atlas Network Access screenshot
3. Share Railway Variables screenshot (hide sensitive values)
