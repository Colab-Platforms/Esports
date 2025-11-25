# Development Workflow Guide

## Branch Strategy

### Branches
- **`main`** - Production branch (Live users)
  - Railway: https://web-production-77ca1.up.railway.app
  - Vercel: https://esports-62sh.vercel.app
  
- **`dev`** - Development branch (Testing)
  - Setup separate Railway/Vercel deployments for this branch

---

## Daily Development Workflow

### 1. Start Working (Always work on `dev` branch)
```bash
# Switch to dev branch
git checkout dev

# Pull latest changes
git pull origin dev
```

### 2. Make Changes & Test Locally
```bash
# Start local development server
npm run dev

# Test your changes at http://localhost:3000
```

### 3. Commit to Dev Branch
```bash
# Add your changes
git add .

# Commit with descriptive message
git commit -m "feat: add new feature"

# Push to dev branch (this will deploy to dev environment)
git push origin dev
```

### 4. Test on Dev Environment
- Wait for Railway/Vercel dev deployment (2-3 min)
- Test thoroughly on dev URLs
- Fix any bugs and repeat step 3

### 5. Merge to Production (Only when everything works!)
```bash
# Switch to main branch
git checkout main

# Pull latest main
git pull origin main

# Merge dev into main
git merge dev

# Push to production
git push origin main
```

---

## Setup Dev Environment on Railway & Vercel

### Railway (Backend)
1. Go to Railway Dashboard
2. Create new project from existing repo
3. Select `dev` branch
4. Add same environment variables
5. Deploy

### Vercel (Frontend)
1. Go to Vercel Dashboard
2. Import same GitHub repo again (or add new branch)
3. Select `dev` branch
4. Add environment variables with dev backend URL
5. Deploy

---

## Commit Message Convention

- `feat:` - New feature
- `fix:` - Bug fix
- `refactor:` - Code refactoring
- `style:` - UI/styling changes
- `docs:` - Documentation
- `test:` - Tests

Example:
```bash
git commit -m "feat: add user profile update"
git commit -m "fix: resolve leaderboard null error"
git commit -m "refactor: improve API error handling"
```

---

## Emergency Hotfix (Production is broken!)

```bash
# Work directly on main (only for emergencies)
git checkout main
git pull origin main

# Make quick fix
# ... edit files ...

git add .
git commit -m "hotfix: critical bug fix"
git push origin main

# Merge back to dev
git checkout dev
git merge main
git push origin dev
```

---

## Quick Reference

### Check current branch
```bash
git branch
```

### Switch branches
```bash
git checkout dev      # Switch to dev
git checkout main     # Switch to main
```

### See what changed
```bash
git status            # See modified files
git diff              # See changes
```

### Undo changes (before commit)
```bash
git checkout -- filename.js    # Undo single file
git reset --hard              # Undo all changes (careful!)
```

---

## Best Practices

✅ **DO:**
- Always work on `dev` branch
- Test locally first
- Test on dev environment before merging to main
- Write clear commit messages
- Commit small, logical changes

❌ **DON'T:**
- Don't push untested code to `main`
- Don't commit directly to `main` (except emergencies)
- Don't push broken code to `dev` either
- Don't commit large, unrelated changes together

---

## Current Setup Status

- ✅ `dev` branch created
- ✅ `main` branch (production)
- ⏳ Setup separate Railway deployment for `dev`
- ⏳ Setup separate Vercel deployment for `dev`

**Next Steps:**
1. Setup Railway project for `dev` branch
2. Setup Vercel project for `dev` branch
3. Start using `dev` for all development work
