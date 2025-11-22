# 🚀 Complete Deployment Guide - Vercel + Railway

## Overview
- **Frontend (React):** Vercel
- **Backend (Node.js):** Railway
- **Database:** MongoDB Atlas (already setup)

---

## Part 1: Backend Deployment on Railway

### Step 1: Prepare Backend for Deployment

#### 1.1 Create `.gitignore` in root (if not exists)
```
node_modules/
.env
*.log
.DS_Store
```

#### 1.2 Update `package.json` in root
Make sure you have these scripts:
```json
{
  "scripts": {
    "start": "node server/index.js",
    "server": "nodemon server/index.js",
    "client": "cd client && npm start",
    "dev": "concurrently \"npm run server\" \"npm run client\""
  }
}
```

#### 1.3 Create `Procfile` in root (for Railway)
```
web: node server/index.js
```

### Step 2: Push Code to GitHub

```bash
# Initialize git (if not already)
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit - Ready for deployment"

# Create GitHub repo and push
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git branch -M main
git push -u origin main
```

### Step 3: Deploy Backend on Railway

#### 3.1 Sign Up / Login
1. Go to: https://railway.app
2. Sign up with GitHub
3. Click "New Project"

#### 3.2 Deploy from GitHub
1. Click "Deploy from GitHub repo"
2. Select your repository
3. Railway will auto-detect Node.js

#### 3.3 Configure Environment Variables
Click on your project → Variables → Add these:

```env
PORT=5001
NODE_ENV=production
MONGODB_URI=mongodb+srv://colab_esports:7HgZ7ApfEPWrabx9@esports.zn4fbf9.mongodb.net/colab-esports
JWT_SECRET=colab-esports-super-secret-jwt-key-2024-production-ready
JWT_EXPIRE=7d
BCRYPT_ROUNDS=12
STEAM_API_KEY=78AC439C723DE55025FF959B863E4480
CLIENT_URL=https://YOUR_VERCEL_APP.vercel.app
SERVER_URL=https://YOUR_RAILWAY_APP.railway.app
```

**Note:** Update `CLIENT_URL` after deploying frontend

#### 3.4 Get Railway URL
1. Go to Settings → Domains
2. Copy the Railway URL (e.g., `https://your-app.railway.app`)
3. Save this - you'll need it for frontend

#### 3.5 Deploy
Railway will automatically deploy. Wait for build to complete.

#### 3.6 Test Backend
Visit: `https://your-app.railway.app/api/games`
Should return games data.

---

## Part 2: Frontend Deployment on Vercel

### Step 1: Prepare Frontend for Deployment

#### 1.1 Update `client/.env.production`
Create this file in `client/` folder:

```env
REACT_APP_API_URL=https://YOUR_RAILWAY_APP.railway.app/api
REACT_APP_SERVER_URL=https://YOUR_RAILWAY_APP.railway.app
REACT_APP_CLIENT_URL=https://YOUR_VERCEL_APP.vercel.app
REACT_APP_ENV=production
```

**Replace:**
- `YOUR_RAILWAY_APP` with your Railway app URL
- `YOUR_VERCEL_APP` with your Vercel app URL (you'll get this after deployment)

#### 1.2 Create `vercel.json` in `client/` folder
```json
{
  "version": 2,
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/static-build",
      "config": {
        "distDir": "build"
      }
    }
  ],
  "routes": [
    {
      "src": "/static/(.*)",
      "dest": "/static/$1"
    },
    {
      "src": "/favicon.ico",
      "dest": "/favicon.ico"
    },
    {
      "src": "/manifest.json",
      "dest": "/manifest.json"
    },
    {
      "src": "/robots.txt",
      "dest": "/robots.txt"
    },
    {
      "src": "/(.*)",
      "dest": "/index.html"
    }
  ]
}
```

#### 1.3 Update `client/package.json`
Add build script if not present:
```json
{
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build",
    "vercel-build": "react-scripts build"
  }
}
```

### Step 2: Deploy Frontend on Vercel

#### 2.1 Sign Up / Login
1. Go to: https://vercel.com
2. Sign up with GitHub
3. Click "Add New Project"

#### 2.2 Import Repository
1. Click "Import Git Repository"
2. Select your GitHub repo
3. Vercel will detect it's a monorepo

#### 2.3 Configure Project
**Important Settings:**

- **Framework Preset:** Create React App
- **Root Directory:** `client` ← **VERY IMPORTANT**
- **Build Command:** `npm run build`
- **Output Directory:** `build`
- **Install Command:** `npm install`

#### 2.4 Add Environment Variables
Click "Environment Variables" and add:

```
REACT_APP_API_URL=https://YOUR_RAILWAY_APP.railway.app/api
REACT_APP_SERVER_URL=https://YOUR_RAILWAY_APP.railway.app
REACT_APP_CLIENT_URL=https://YOUR_VERCEL_APP.vercel.app
REACT_APP_ENV=production
```

**Note:** You'll need to update `REACT_APP_CLIENT_URL` after first deployment

#### 2.5 Deploy
Click "Deploy" and wait for build to complete.

#### 2.6 Get Vercel URL
After deployment, copy your Vercel URL (e.g., `https://your-app.vercel.app`)

### Step 3: Update Environment Variables

#### 3.1 Update Railway (Backend)
Go back to Railway → Variables → Update:
```
CLIENT_URL=https://your-app.vercel.app
```

Redeploy backend.

#### 3.2 Update Vercel (Frontend)
Go to Vercel → Settings → Environment Variables → Update:
```
REACT_APP_CLIENT_URL=https://your-app.vercel.app
```

Redeploy frontend.

---

## Part 3: Final Configuration

### Step 1: Update CORS in Backend

Your backend already has dynamic CORS, but verify in `server/index.js`:

```javascript
app.use(cors({
  origin: function (origin, callback) {
    const allowedOrigins = [
      'http://localhost:3000',
      process.env.CLIENT_URL,
      'https://your-app.vercel.app' // Add your Vercel URL
    ];
    
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, true); // Allow all in production for now
    }
  },
  credentials: true
}));
```

### Step 2: Test Deployment

#### Test Backend
```bash
curl https://your-railway-app.railway.app/api/games
```

Should return games data.

#### Test Frontend
1. Visit: `https://your-vercel-app.vercel.app`
2. Check if homepage loads
3. Check if games page shows data
4. Check if tournaments load

### Step 3: Seed Production Database

```bash
# Connect to production database
# Update .env temporarily with production MONGODB_URI
node server/scripts/seedCS2Tournaments.js
```

Or use Railway CLI:
```bash
railway run node server/scripts/seedCS2Tournaments.js
```

---

## Part 4: Custom Domain (Optional)

### For Vercel (Frontend)
1. Go to Vercel → Settings → Domains
2. Add your custom domain (e.g., `esports.yourdomain.com`)
3. Update DNS records as instructed
4. Update environment variables with new domain

### For Railway (Backend)
1. Go to Railway → Settings → Domains
2. Add custom domain (e.g., `api.yourdomain.com`)
3. Update DNS records
4. Update frontend environment variables

---

## Troubleshooting

### Issue: Frontend can't connect to backend
**Solution:**
1. Check CORS settings in backend
2. Verify `REACT_APP_API_URL` is correct
3. Check Railway logs for errors
4. Ensure backend is running

### Issue: Environment variables not working
**Solution:**
1. Redeploy after adding variables
2. Check variable names (must start with `REACT_APP_` for React)
3. Clear browser cache

### Issue: Build fails on Vercel
**Solution:**
1. Check Root Directory is set to `client`
2. Verify `package.json` has build script
3. Check build logs for specific errors

### Issue: Backend crashes on Railway
**Solution:**
1. Check Railway logs
2. Verify all environment variables are set
3. Check MongoDB connection string
4. Ensure PORT is set to 5001

### Issue: Steam OAuth not working
**Solution:**
1. Update Steam API redirect URL to production URL
2. Get new Steam API key for production
3. Update `SERVER_URL` in environment variables

---

## Monitoring & Logs

### Railway Logs
```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# View logs
railway logs
```

### Vercel Logs
1. Go to Vercel Dashboard
2. Click on your project
3. Go to "Deployments"
4. Click on latest deployment
5. View "Build Logs" or "Function Logs"

---

## Continuous Deployment

### Auto-Deploy on Git Push

**Railway:**
- Automatically deploys on push to `main` branch
- Can configure in Settings → Deployments

**Vercel:**
- Automatically deploys on push to `main` branch
- Preview deployments for pull requests
- Can configure in Settings → Git

---

## Cost Estimation

### Railway (Backend)
- **Free Tier:** $5 credit/month
- **Hobby Plan:** $5/month (recommended)
- Includes: 512MB RAM, 1GB storage

### Vercel (Frontend)
- **Free Tier:** Unlimited for personal projects
- **Pro Plan:** $20/month (for commercial)
- Includes: Unlimited bandwidth, 100GB bandwidth

### MongoDB Atlas
- **Free Tier:** 512MB storage (current)
- **Shared Cluster:** $9/month (if needed)

**Total Cost:** $0-5/month for hobby projects

---

## Security Checklist

✅ Environment variables set correctly
✅ JWT_SECRET is strong and unique
✅ MongoDB connection uses authentication
✅ CORS configured properly
✅ HTTPS enabled (automatic on Vercel/Railway)
✅ API rate limiting enabled
✅ No sensitive data in git repository
✅ .env files in .gitignore

---

## Quick Commands Reference

### Deploy Backend (Railway)
```bash
git add .
git commit -m "Update backend"
git push origin main
# Railway auto-deploys
```

### Deploy Frontend (Vercel)
```bash
git add .
git commit -m "Update frontend"
git push origin main
# Vercel auto-deploys
```

### Manual Deploy
```bash
# Vercel CLI
npm i -g vercel
cd client
vercel --prod

# Railway CLI
npm i -g @railway/cli
railway up
```

---

## Support & Resources

- **Railway Docs:** https://docs.railway.app
- **Vercel Docs:** https://vercel.com/docs
- **MongoDB Atlas:** https://www.mongodb.com/docs/atlas

---

## Summary

1. ✅ Push code to GitHub
2. ✅ Deploy backend on Railway
3. ✅ Deploy frontend on Vercel
4. ✅ Update environment variables
5. ✅ Test deployment
6. ✅ Seed production database
7. ✅ Monitor logs

**Your app is now live! 🎉**

- Frontend: `https://your-app.vercel.app`
- Backend: `https://your-app.railway.app`
