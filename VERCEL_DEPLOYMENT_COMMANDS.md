# ⚡ Vercel Deployment - Quick Commands

## Your Railway URL
First, get your Railway URL from Railway Dashboard.

**Example:** `https://web-production-abc123.up.railway.app`

---

## Step 1: Update Frontend Config

```bash
# Edit client/.env.production
# Replace YOUR_RAILWAY_APP with your actual Railway URL

# Example content:
REACT_APP_API_URL=https://web-production-abc123.up.railway.app/api
REACT_APP_SERVER_URL=https://web-production-abc123.up.railway.app
REACT_APP_CLIENT_URL=https://your-app.vercel.app
REACT_APP_ENV=production
```

---

## Step 2: Commit and Push

```bash
git add client/.env.production
git commit -m "Add production config for Vercel deployment"
git push origin main
```

---

## Step 3: Deploy on Vercel

### Option A: Vercel Dashboard (Recommended)

1. Go to: **https://vercel.com**
2. Sign up with GitHub
3. Click **"Add New Project"**
4. Import your repository
5. **IMPORTANT:** Set Root Directory to `client`
6. Add environment variables
7. Click **"Deploy"**

### Option B: Vercel CLI (Advanced)

```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy from client folder
cd client
vercel --prod

# Follow prompts:
# - Set up and deploy? Yes
# - Which scope? Your account
# - Link to existing project? No
# - Project name? your-app-name
# - Directory? ./ (current)
# - Override settings? Yes
# - Build Command? npm run build
# - Output Directory? build
# - Development Command? npm start
```

---

## Step 4: After Deployment

### Get Your Vercel URL
After deployment, Vercel will show your URL:
```
https://your-app.vercel.app
```

### Update Environment Variables

#### In Vercel:
```bash
# Go to Vercel Dashboard
# Your Project → Settings → Environment Variables
# Update REACT_APP_CLIENT_URL with your actual Vercel URL
```

#### In Railway:
```bash
# Go to Railway Dashboard
# Your Project → Variables
# Update CLIENT_URL with your Vercel URL
```

---

## Step 5: Test Deployment

```bash
# Test backend
curl https://your-railway-app.up.railway.app/api/games

# Test frontend
# Open in browser: https://your-app.vercel.app
```

---

## Quick Reference

### Vercel Settings
```
Framework: Create React App
Root Directory: client
Build Command: npm run build
Output Directory: build
Install Command: npm install
```

### Environment Variables (Vercel)
```
REACT_APP_API_URL=https://YOUR_RAILWAY_URL/api
REACT_APP_SERVER_URL=https://YOUR_RAILWAY_URL
REACT_APP_CLIENT_URL=https://YOUR_VERCEL_URL
REACT_APP_ENV=production
```

### Environment Variables (Railway)
```
CLIENT_URL=https://YOUR_VERCEL_URL
```

---

## Redeploy Commands

### Redeploy Frontend (Vercel)
```bash
# Option 1: Push to GitHub (auto-deploys)
git push origin main

# Option 2: Vercel Dashboard
# Deployments → Click "Redeploy"

# Option 3: Vercel CLI
cd client
vercel --prod
```

### Redeploy Backend (Railway)
```bash
# Option 1: Push to GitHub (auto-deploys)
git push origin main

# Option 2: Railway Dashboard
# Deployments → Click "Redeploy"
```

---

## Troubleshooting Commands

### Check Vercel Logs
```bash
# Using CLI
vercel logs

# Or in Dashboard:
# Your Project → Deployments → View Logs
```

### Check Railway Logs
```bash
# Using CLI
railway logs

# Or in Dashboard:
# Your Project → Deployments → View Logs
```

### Test API Connection
```bash
# Test from command line
curl https://your-railway-app.up.railway.app/api/games

# Should return JSON with games data
```

---

## Common Issues

### Issue: "Root Directory not found"
```bash
# Solution: Set Root Directory to "client" in Vercel settings
```

### Issue: "Environment variables not working"
```bash
# Solution: Redeploy after adding variables
# Vercel Dashboard → Deployments → Redeploy
```

### Issue: "API calls failing"
```bash
# Solution: Check REACT_APP_API_URL is correct
# Should end with /api
# Example: https://your-app.railway.app/api
```

---

## Success Indicators

### Vercel Deployment Success:
```
✓ Build completed
✓ Deployment ready
✓ Assigned to production
```

### Railway Deployment Success:
```
✓ Server running on port 5001
✓ MongoDB connected successfully
✓ Database seeding completed
```

### App Working:
```
✓ Frontend loads at Vercel URL
✓ Games page shows data
✓ Tournaments page works
✓ No console errors
✓ API calls successful
```

---

## 🎉 You're Done!

Once both deployments are successful:
- Frontend: `https://your-app.vercel.app`
- Backend: `https://your-app.railway.app`

Your app is now live and accessible worldwide! 🌍
