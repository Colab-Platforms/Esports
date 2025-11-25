# Quick Start - Development Setup

## 🚀 Setup (One-time only)

### 1. Railway - Dev Backend
1. Go to https://railway.app
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your repo: `Colab-Platforms/Esports`
4. **Important:** In settings, change branch from `main` to `dev`
5. Add all environment variables (same as production)
6. Copy the new Railway URL (e.g., `https://web-production-xxxxx.up.railway.app`)

### 2. Vercel - Dev Frontend
**Option A: New Project (Recommended)**
1. Go to https://vercel.com
2. Click "Add New" → "Project"
3. Import same GitHub repo
4. **Project Name:** `esports-dev` (different from production)
5. **Framework:** Create React App
6. **Root Directory:** `client`
7. **Branch:** `dev`
8. **Environment Variables:**
   ```
   REACT_APP_API_URL=<your-dev-railway-url>
   ```
9. Deploy

**Option B: Add Branch to Existing Project**
1. Go to existing Vercel project
2. Settings → Git → Production Branch
3. Add `dev` as preview branch
4. It will auto-deploy on `dev` branch pushes

---

## 📝 Daily Workflow (Simple!)

### Start of Day
```bash
git checkout dev
git pull origin dev
```

### Make Changes
```bash
# Edit files...
# Test locally with: npm run dev

git add .
git commit -m "feat: your change description"
git push origin dev
```

### Deploy to Production (When ready)
```bash
git checkout main
git merge dev
git push origin main
```

---

## 🔧 Local Development

### Full Local Setup (Recommended)
```bash
# Terminal 1 - Backend
npm run server

# Terminal 2 - Frontend
cd client
npm start
```

**URLs:**
- **Frontend:** http://localhost:3000
- **Backend:** http://localhost:5001

**Make sure `client/.env` has:**
```env
REACT_APP_API_URL=http://localhost:5001
```

### Quick Local (Frontend only)
If you don't want to run backend locally:

**Update `client/.env`:**
```env
REACT_APP_API_URL=https://your-dev-railway-url.up.railway.app
```

Then:
```bash
cd client
npm start
```

---

## 🌐 Deployment URLs

### Development (Testing)
- **Frontend:** https://esports-dev.vercel.app (or preview URL)
- **Backend:** https://web-production-xxxxx.up.railway.app (your dev Railway)

### Production (Live)
- **Frontend:** https://esports-62sh.vercel.app
- **Backend:** https://web-production-77ca1.up.railway.app

---

## ⚡ Quick Commands

```bash
# Check which branch you're on
git branch

# Switch to dev
git checkout dev

# Switch to main
git checkout main

# See what you changed
git status

# Undo all changes (careful!)
git reset --hard
```

---

## 🎯 Remember

1. **Always work on `dev` branch**
2. **Test on dev environment first**
3. **Only merge to `main` when everything works**
4. **Production users won't see your experiments**

---

## 🆘 Help

**Accidentally pushed to main?**
```bash
# Revert last commit (if not deployed yet)
git revert HEAD
git push origin main
```

**Want to test something risky?**
```bash
# Create a feature branch from dev
git checkout dev
git checkout -b feature/my-experiment

# Work on it, test it
# If good: merge to dev
# If bad: just delete the branch
```
