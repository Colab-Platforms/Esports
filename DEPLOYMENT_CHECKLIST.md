# 🚀 Deployment Checklist

## Pre-Deployment

### Code Preparation
- [ ] All code committed to git
- [ ] `.gitignore` includes `node_modules/`, `.env`, `*.log`
- [ ] `Procfile` created in root
- [ ] `client/vercel.json` created
- [ ] `client/.env.production` created
- [ ] No console.logs in production code
- [ ] All dependencies in `package.json`

### Environment Variables Ready
- [ ] MongoDB URI
- [ ] JWT Secret
- [ ] Steam API Key
- [ ] Port numbers
- [ ] CORS origins

---

## Backend Deployment (Railway)

### Step 1: GitHub Setup
- [ ] Create GitHub repository
- [ ] Push code to GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/REPO_NAME.git
git push -u origin main
```

### Step 2: Railway Setup
- [ ] Sign up at https://railway.app
- [ ] Create new project
- [ ] Deploy from GitHub repo
- [ ] Select your repository

### Step 3: Environment Variables
Add these in Railway → Variables:
- [ ] `PORT=5001`
- [ ] `NODE_ENV=production`
- [ ] `MONGODB_URI=your_mongodb_uri`
- [ ] `JWT_SECRET=your_jwt_secret`
- [ ] `JWT_EXPIRE=7d`
- [ ] `BCRYPT_ROUNDS=12`
- [ ] `STEAM_API_KEY=your_steam_key`
- [ ] `CLIENT_URL=https://YOUR_VERCEL_APP.vercel.app` (update later)
- [ ] `SERVER_URL=https://YOUR_RAILWAY_APP.railway.app`

### Step 4: Get Railway URL
- [ ] Go to Settings → Domains
- [ ] Copy Railway URL
- [ ] Save for frontend configuration

### Step 5: Test Backend
- [ ] Visit `https://your-app.railway.app/api/games`
- [ ] Should return games data
- [ ] Check Railway logs for errors

---

## Frontend Deployment (Vercel)

### Step 1: Update Production Config
Edit `client/.env.production`:
- [ ] Update `REACT_APP_API_URL` with Railway URL
- [ ] Update `REACT_APP_SERVER_URL` with Railway URL
- [ ] Keep `REACT_APP_CLIENT_URL` as placeholder

### Step 2: Vercel Setup
- [ ] Sign up at https://vercel.com
- [ ] Click "Add New Project"
- [ ] Import your GitHub repository

### Step 3: Configure Project
**IMPORTANT:** Set these correctly:
- [ ] Framework Preset: `Create React App`
- [ ] Root Directory: `client` ← **CRITICAL**
- [ ] Build Command: `npm run build`
- [ ] Output Directory: `build`
- [ ] Install Command: `npm install`

### Step 4: Environment Variables
Add in Vercel → Environment Variables:
- [ ] `REACT_APP_API_URL=https://YOUR_RAILWAY_APP.railway.app/api`
- [ ] `REACT_APP_SERVER_URL=https://YOUR_RAILWAY_APP.railway.app`
- [ ] `REACT_APP_CLIENT_URL=https://YOUR_VERCEL_APP.vercel.app` (update after)
- [ ] `REACT_APP_ENV=production`

### Step 5: Deploy
- [ ] Click "Deploy"
- [ ] Wait for build to complete
- [ ] Copy Vercel URL

### Step 6: Update URLs
- [ ] Update `REACT_APP_CLIENT_URL` in Vercel with actual Vercel URL
- [ ] Update `CLIENT_URL` in Railway with Vercel URL
- [ ] Redeploy both

---

## Post-Deployment

### Testing
- [ ] Frontend loads: `https://your-app.vercel.app`
- [ ] Homepage displays correctly
- [ ] Games page shows data
- [ ] Tournaments load
- [ ] Can navigate between pages
- [ ] API calls work (check Network tab)
- [ ] No console errors

### Backend Testing
- [ ] API responds: `https://your-app.railway.app/api/games`
- [ ] CORS working (no CORS errors in browser)
- [ ] Database connected (check Railway logs)
- [ ] All routes accessible

### Database
- [ ] Seed production database
```bash
# Option 1: Local with production URI
node server/scripts/seedCS2Tournaments.js

# Option 2: Railway CLI
railway run node server/scripts/seedCS2Tournaments.js
```
- [ ] Verify data appears on frontend

### Security
- [ ] HTTPS enabled (automatic)
- [ ] Environment variables not exposed
- [ ] No sensitive data in git
- [ ] CORS configured correctly
- [ ] Rate limiting active

---

## Monitoring

### Railway
- [ ] Check deployment logs
- [ ] Monitor resource usage
- [ ] Set up alerts (optional)

### Vercel
- [ ] Check build logs
- [ ] Monitor function logs
- [ ] Check analytics (optional)

---

## Troubleshooting

### Frontend Issues
**Problem:** Blank page
- [ ] Check browser console for errors
- [ ] Verify `REACT_APP_API_URL` is correct
- [ ] Check Vercel build logs
- [ ] Ensure Root Directory is `client`

**Problem:** API calls failing
- [ ] Check Network tab in browser
- [ ] Verify backend URL is correct
- [ ] Check CORS errors
- [ ] Test backend URL directly

### Backend Issues
**Problem:** App not starting
- [ ] Check Railway logs
- [ ] Verify all environment variables set
- [ ] Check MongoDB connection
- [ ] Verify `PORT` is set

**Problem:** Database connection failed
- [ ] Check MongoDB URI is correct
- [ ] Verify MongoDB Atlas allows Railway IP
- [ ] Check database user permissions

---

## Continuous Deployment

### Auto-Deploy Setup
- [ ] Railway auto-deploys on push to `main`
- [ ] Vercel auto-deploys on push to `main`
- [ ] Test by making a small change and pushing

### Manual Deploy
```bash
# Make changes
git add .
git commit -m "Your message"
git push origin main

# Both platforms auto-deploy
```

---

## URLs to Save

### Production URLs
```
Frontend: https://_____________________.vercel.app
Backend:  https://_____________________.railway.app
Database: mongodb+srv://...
```

### Admin Access
```
Railway:  https://railway.app/dashboard
Vercel:   https://vercel.com/dashboard
MongoDB:  https://cloud.mongodb.com
GitHub:   https://github.com/YOUR_USERNAME/REPO_NAME
```

---

## Cost Tracking

### Current Plan
- Railway: Free ($5 credit/month)
- Vercel: Free (Hobby)
- MongoDB: Free (512MB)

### Upgrade When Needed
- Railway Hobby: $5/month
- Vercel Pro: $20/month
- MongoDB Shared: $9/month

---

## Support

### Documentation
- Railway: https://docs.railway.app
- Vercel: https://vercel.com/docs
- MongoDB: https://www.mongodb.com/docs/atlas

### Community
- Railway Discord: https://discord.gg/railway
- Vercel Discord: https://vercel.com/discord

---

## Final Checklist

- [ ] Backend deployed and running
- [ ] Frontend deployed and accessible
- [ ] Environment variables configured
- [ ] Database seeded with data
- [ ] All features working
- [ ] No errors in logs
- [ ] HTTPS enabled
- [ ] Auto-deployment working

## 🎉 Deployment Complete!

Your app is now live and accessible worldwide!

**Next Steps:**
1. Share your app URL
2. Monitor logs regularly
3. Set up custom domain (optional)
4. Add monitoring/analytics
5. Plan for scaling
