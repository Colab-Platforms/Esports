# 🚂 Railway Dashboard - Direct Fix

## Problem
Railway is still trying to build the client folder even after config files.

## Solution: Configure in Railway Dashboard

### Step 1: Go to Railway Settings

1. Open Railway Dashboard
2. Click on your project: **web**
3. Click **Settings** tab (top right)

### Step 2: Configure Build Settings

Scroll down to find these sections and update:

#### A. Build Settings
```
Build Command: (leave empty or delete any command)
```

#### B. Deploy Settings
```
Start Command: node server/index.js
```

#### C. Watch Paths (Important!)
```
Watch Paths: server/**
```
This tells Railway to only watch server folder changes.

### Step 3: Add Environment Variables

Click **Variables** tab and add:

```env
PORT=5001
NODE_ENV=production
MONGODB_URI=mongodb+srv://colab_esports:NEW_PASSWORD@esports.zn4fbf9.mongodb.net/colab-esports
JWT_SECRET=your_new_jwt_secret_here
JWT_EXPIRE=7d
BCRYPT_ROUNDS=12
STEAM_API_KEY=your_new_steam_key_here
CLIENT_URL=https://your-app.vercel.app
SERVER_URL=${{RAILWAY_PUBLIC_DOMAIN}}
```

**IMPORTANT:** Use NEW rotated credentials!

### Step 4: Redeploy

1. Go to **Deployments** tab
2. Click the **three dots** (•••) on latest deployment
3. Click **Redeploy**

OR

1. Click **Deploy** button (top right)
2. Select **Redeploy**

### Step 5: Watch Logs

After redeploying:
1. Click on the new deployment
2. Watch the logs
3. Should see:
   ```
   ✅ Installing dependencies
   ✅ Starting: node server/index.js
   ✅ Server running on port 5001
   ✅ MongoDB connected
   ```

## Alternative: Use Nixpacks Config

If above doesn't work, create `nixpacks.toml` in root:

```toml
[phases.setup]
nixPkgs = ["nodejs-18_x"]

[phases.install]
cmds = ["npm install"]

[phases.build]
cmds = []

[start]
cmd = "node server/index.js"
```

Then commit and push:
```bash
git add nixpacks.toml
git commit -m "Add Nixpacks config for Railway"
git push origin main
```

## What Railway Should Do

✅ Install dependencies from root package.json
✅ Skip any build commands
✅ Start server with: node server/index.js
✅ Ignore client folder completely

## What Railway Should NOT Do

❌ cd client && npm run build
❌ react-scripts build
❌ Build frontend
❌ Install client dependencies

## Verification

### Success Logs:
```
[stage-0] Installing dependencies
[stage-0] npm install
[stage-0] added 150 packages
[stage-1] Starting application
[stage-1] node server/index.js
[stage-1] 🚀 Server running on port 5001
[stage-1] 🎮 MongoDB connected successfully
```

### Failure Logs (what you're seeing now):
```
[stage-0] cd client && npm run build
[stage-0] sh: 1: react-scripts: not found
[stage-0] Build failed
```

## Quick Fix Checklist

- [ ] Railway Settings → Start Command: `node server/index.js`
- [ ] Railway Settings → Build Command: (empty)
- [ ] Railway Settings → Watch Paths: `server/**`
- [ ] Environment variables added
- [ ] Redeployed
- [ ] Logs show success

## If Still Not Working

### Option: Delete and Recreate Project

1. Railway Dashboard → Your Project
2. Settings → Danger Zone
3. Delete Project
4. Create New Project
5. Deploy from GitHub
6. **IMMEDIATELY** set Start Command before first deploy
7. Add environment variables
8. Deploy

## Root Cause

Railway's auto-detection is seeing:
- Root `package.json` with `build` script
- `build` script runs `cd client && npm run build`
- Railway thinks it needs to build frontend

## Solution

Tell Railway explicitly:
- Don't run build command
- Just start with: `node server/index.js`
- Only watch server folder

---

## 🎯 Exact Steps to Follow NOW:

1. **Railway Dashboard** → Your Project
2. **Settings** tab
3. Find **Start Command** field
4. Enter: `node server/index.js`
5. Find **Build Command** field
6. Clear it (leave empty)
7. **Save** (if there's a save button)
8. **Deployments** tab
9. Click **Redeploy**
10. Watch logs - should work now!

---

## Need Screenshot?

If you're not sure where these settings are, the fields are usually in:
- Settings → Deploy section
- Settings → Build section
- Look for "Start Command" or "Custom Start Command"
