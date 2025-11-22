# ⚡ Quick Start Deployment Guide

## 🎯 Goal
Deploy your Esports Platform:
- **Frontend** → Vercel (Free)
- **Backend** → Railway (Free)
- **Database** → MongoDB Atlas (Already setup)

---

## 📋 Prerequisites

✅ GitHub account
✅ Railway account (sign up with GitHub)
✅ Vercel account (sign up with GitHub)
✅ Code ready in this repository

---

## 🚀 Part 1: Backend on Railway (10 minutes)

### Step 1: Push to GitHub
```bash
# In your project root
git init
git add .
git commit -m "Ready for deployment"

# Create repo on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

### Step 2: Deploy on Railway
1. Go to: **https://railway.app**
2. Click **"Start a New Project"**
3. Select **"Deploy from GitHub repo"**
4. Choose your repository
5. Railway will start building automatically

### Step 3: Add Environment Variables
Click on your project → **Variables** tab → Add these:

```
PORT=5001
NODE_ENV=production
MONGODB_URI=mongodb+srv://colab_esports:7HgZ7ApfEPWrabx9@esports.zn4fbf9.mongodb.net/colab-esports
JWT_SECRET=colab-esports-super-secret-jwt-key-2024-production-ready
JWT_EXPIRE=7d
BCRYPT_ROUNDS=12
STEAM_API_KEY=78AC439C723DE55025FF959B863E4480
CLIENT_URL=https://YOUR_APP.vercel.app
SERVER_URL=${{RAILWAY_PUBLIC_DOMAIN}}
```

**Note:** `CLIENT_URL` will be updated after frontend deployment

### Step 4: Get Your Railway URL
1. Go to **Settings** → **Networking**
2. Click **"Generate Domain"**
3. Copy the URL (e.g., `https://your-app.up.railway.app`)
4. **SAVE THIS URL** - you'll need it for frontend!

### Step 5: Test Backend
Visit: `https://your-app.up.railway.app/api/games`

Should see games data! ✅

---

## 🎨 Part 2: Frontend on Vercel (10 minutes)

### Step 1: Update Production Config
Edit `client/.env.production` with your Railway URL:

```env
REACT_APP_API_URL=https://YOUR_RAILWAY_APP.up.railway.app/api
REACT_APP_SERVER_URL=https://YOUR_RAILWAY_APP.up.railway.app
REACT_APP_CLIENT_URL=https://YOUR_APP.vercel.app
REACT_APP_ENV=production
```

Commit and push:
```bash
git add client/.env.production
git commit -m "Update production config"
git push origin main
```

### Step 2: Deploy on Vercel
1. Go to: **https://vercel.com**
2. Click **"Add New Project"**
3. Click **"Import Git Repository"**
4. Select your GitHub repository
5. Click **"Import"**

### Step 3: Configure Build Settings
**⚠️ CRITICAL SETTINGS:**

```
Framework Preset: Create React App
Root Directory: client          ← MUST BE "client"
Build Command: npm run build
Output Directory: build
Install Command: npm install
```

### Step 4: Add Environment Variables
Click **"Environment Variables"** → Add these:

```
REACT_APP_API_URL=https://YOUR_RAILWAY_APP.up.railway.app/api
REACT_APP_SERVER_URL=https://YOUR_RAILWAY_APP.up.railway.app
REACT_APP_CLIENT_URL=https://YOUR_APP.vercel.app
REACT_APP_ENV=production
```

### Step 5: Deploy
Click **"Deploy"** and wait 2-3 minutes.

### Step 6: Get Your Vercel URL
After deployment completes:
1. Copy your Vercel URL (e.g., `https://your-app.vercel.app`)
2. **SAVE THIS URL**

---

## 🔄 Part 3: Update URLs (5 minutes)

### Update Railway
1. Go back to Railway
2. Click **Variables**
3. Update `CLIENT_URL` with your Vercel URL
4. Railway will auto-redeploy

### Update Vercel
1. Go to Vercel → Your Project
2. Click **Settings** → **Environment Variables**
3. Update `REACT_APP_CLIENT_URL` with your actual Vercel URL
4. Click **"Redeploy"** from Deployments tab

---

## 🎮 Part 4: Seed Database (2 minutes)

### Option 1: Using Railway CLI
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link to your project
railway link

# Run seed script
railway run node server/scripts/seedCS2Tournaments.js
```

### Option 2: Manual (if CLI doesn't work)
1. Temporarily update local `.env` with production MongoDB URI
2. Run: `node server/scripts/seedCS2Tournaments.js`
3. Revert `.env` back to local settings

---

## ✅ Part 5: Test Everything (5 minutes)

### Test Frontend
Visit your Vercel URL: `https://your-app.vercel.app`

Check:
- [ ] Homepage loads
- [ ] Games page shows games
- [ ] Tournaments page shows tournaments
- [ ] Can click on tournaments
- [ ] No errors in browser console (F12)

### Test Backend
Visit: `https://your-app.up.railway.app/api/games`

Should return JSON with games data.

### Test API Connection
1. Open your Vercel app
2. Open browser DevTools (F12)
3. Go to Network tab
4. Navigate to Games page
5. Should see successful API calls to Railway URL

---

## 🎉 Success!

Your app is now live!

**Your URLs:**
- Frontend: `https://your-app.vercel.app`
- Backend: `https://your-app.up.railway.app`

---

## 🔧 Common Issues & Fixes

### Issue: Frontend shows blank page
**Fix:**
1. Check Vercel build logs
2. Verify Root Directory is set to `client`
3. Check browser console for errors

### Issue: "Failed to fetch" errors
**Fix:**
1. Verify `REACT_APP_API_URL` is correct
2. Check Railway is running (green status)
3. Test backend URL directly in browser

### Issue: CORS errors
**Fix:**
1. Update `CLIENT_URL` in Railway
2. Redeploy Railway
3. Clear browser cache

### Issue: Database connection failed
**Fix:**
1. Check MongoDB URI is correct
2. Verify MongoDB Atlas allows Railway IP (0.0.0.0/0)
3. Check Railway logs for specific error

---

## 📱 Share Your App

Your app is now live! Share these URLs:

```
🌐 Website: https://your-app.vercel.app
🎮 Games: https://your-app.vercel.app/games
🏆 Tournaments: https://your-app.vercel.app/tournaments
```

---

## 🔄 Making Updates

### Update Code
```bash
# Make your changes
git add .
git commit -m "Your update message"
git push origin main

# Both Railway and Vercel auto-deploy!
```

### View Logs
- **Railway:** Dashboard → Your Project → Logs
- **Vercel:** Dashboard → Your Project → Deployments → View Logs

---

## 💰 Cost

**Current Setup: FREE**
- Railway: $5 credit/month (free tier)
- Vercel: Unlimited for hobby projects
- MongoDB: 512MB free tier

**When to Upgrade:**
- Railway: When you exceed $5/month usage
- Vercel: When you need team features
- MongoDB: When you need more than 512MB

---

## 📚 Next Steps

1. ✅ Add custom domain (optional)
2. ✅ Set up monitoring
3. ✅ Add analytics
4. ✅ Configure alerts
5. ✅ Plan for scaling

---

## 🆘 Need Help?

- **Railway Docs:** https://docs.railway.app
- **Vercel Docs:** https://vercel.com/docs
- **Railway Discord:** https://discord.gg/railway
- **Vercel Discord:** https://vercel.com/discord

---

## ⏱️ Total Time: ~30 minutes

- Backend setup: 10 min
- Frontend setup: 10 min
- Configuration: 5 min
- Testing: 5 min

**You're done! 🎊**
