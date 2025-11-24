# MongoDB Connection Fix - Windows Commands

## Problem Identified
```
"Operation `users.deleteMany()` buffering timed out after 10000ms"
```

This means MongoDB Atlas is blocking Railway's IP address.

## Solution: Allow All IPs in MongoDB Atlas

### Step 1: Fix MongoDB Atlas Network Access
1. Go to: https://cloud.mongodb.com/
2. Login with your credentials
3. Select your project (esports cluster)
4. Click **"Network Access"** in left sidebar
5. Click **"Add IP Address"** button
6. Select **"Allow Access from Anywhere"**
7. This will add: `0.0.0.0/0` (allows all IPs)
8. Click **"Confirm"**
9. Wait 2-3 minutes for changes to propagate

### Step 2: Test Connection (After 2-3 Minutes)

```powershell
# Test health endpoint
Invoke-WebRequest -Uri "https://web-production-77ca1.up.railway.app/api/health" -Method GET

# Seed database
Invoke-WebRequest -Uri "https://web-production-77ca1.up.railway.app/api/seed-database" -Method POST

# Test tournaments
Invoke-WebRequest -Uri "https://web-production-77ca1.up.railway.app/api/tournaments" -Method GET

# Test stats
Invoke-WebRequest -Uri "https://web-production-77ca1.up.railway.app/api/tournaments/stats" -Method GET
```

### Step 3: Verify Data in Browser
After seeding, open:
```
https://esports-62sh.vercel.app
```

Data should load now!

## Alternative: Add Railway's Specific IP

If you don't want to allow all IPs, you can add Railway's specific IP:

1. Check Railway logs for the outbound IP
2. Add that specific IP in MongoDB Atlas Network Access
3. But **"Allow from Anywhere"** is easier for deployment

## Common MongoDB Atlas Issues

### Issue 1: Wrong Cluster
Make sure you're in the correct project/cluster in MongoDB Atlas.

### Issue 2: Database User Password
Verify database user credentials:
- Username: `colab_esports`
- Password: `qZgaDLfllrytAKqM`

Go to: Database Access → Check user exists

### Issue 3: Connection String
Current connection string:
```
mongodb+srv://colab_esports:qZgaDLfllrytAKqM@esports.zn4fbf9.mongodb.net/colab-esports
```

Make sure this is set in Railway environment variables.

## After Fix - Complete Test

```powershell
# 1. Health check
Invoke-WebRequest -Uri "https://web-production-77ca1.up.railway.app/api/health"

# 2. Seed database (creates sample data)
Invoke-WebRequest -Uri "https://web-production-77ca1.up.railway.app/api/seed-database" -Method POST

# 3. Get tournaments
$response = Invoke-WebRequest -Uri "https://web-production-77ca1.up.railway.app/api/tournaments"
$response.Content | ConvertFrom-Json | ConvertTo-Json -Depth 10

# 4. Get stats
$response = Invoke-WebRequest -Uri "https://web-production-77ca1.up.railway.app/api/tournaments/stats"
$response.Content | ConvertFrom-Json | ConvertTo-Json -Depth 10

# 5. Get games
$response = Invoke-WebRequest -Uri "https://web-production-77ca1.up.railway.app/api/games"
$response.Content | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

## Expected Success Response

After seeding, you should see:
```json
{
  "success": true,
  "data": {
    "users": 6,
    "tournaments": 7,
    "leaderboardEntries": 54,
    "gameServers": 3,
    "message": "Database seeded successfully with comprehensive data"
  },
  "message": "Complete database seeding completed successfully",
  "timestamp": "2025-11-22T..."
}
```

## Troubleshooting

### If Still Timeout After IP Whitelist:
1. Check MongoDB Atlas status page
2. Verify cluster is running (not paused)
3. Check if free tier has limits
4. Try restarting Railway deployment

### If "Authentication Failed":
1. Go to Database Access in MongoDB Atlas
2. Verify user `colab_esports` exists
3. Reset password if needed
4. Update `MONGODB_URI` in Railway with new password

### If "Database Not Found":
The database `colab-esports` will be created automatically when you seed data.
