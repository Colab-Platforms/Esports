# Deployment URLs Reference

## 🚀 Production (Live Users)

### Frontend (Vercel)
- **URL:** https://esports-62sh.vercel.app
- **Project Name:** esports-62sh
- **Branch:** `main`
- **Status:** ✅ Live

### Backend (Railway)
- **URL:** https://web-production-77ca1.up.railway.app
- **Project Name:** web-production-77ca1
- **Branch:** `main`
- **Status:** ✅ Live

### Environment Variables
**Vercel Production:**
```env
REACT_APP_API_URL=https://web-production-77ca1.up.railway.app
```

**Railway Production:**
```env
CLIENT_URL=https://esports-62sh.vercel.app
NODE_ENV=production
```

---

## 🧪 Development (Testing)

### Frontend (Vercel)
- **URL:** https://esports-eciq.vercel.app
- **Project Name:** esports-eciq
- **Branch:** `dev`
- **Status:** ✅ Active

### Backend (Railway)
- **URL:** [Your new Railway dev URL]
- **Project Name:** [Your Railway dev project name]
- **Branch:** `dev`
- **Status:** ✅ Active

### Environment Variables
**Vercel Dev:**
```env
REACT_APP_API_URL=[Your Railway dev URL]
```

**Railway Dev:**
```env
CLIENT_URL=https://esports-eciq.vercel.app
NODE_ENV=development
```

---

## 🔍 How to Identify

### Method 1: Check URL
- **Production:** `esports-62sh.vercel.app`
- **Dev:** `esports-eciq.vercel.app`

### Method 2: Check Browser Console
Open any page → F12 → Console → Type:
```javascript
console.log(process.env.REACT_APP_API_URL)
```

**Production will show:** `https://web-production-77ca1.up.railway.app`
**Dev will show:** `https://web-production-xxxxx.up.railway.app` (different)

### Method 3: Check Network Tab
F12 → Network → Try any API call → Check URL:
- **Production:** Goes to `web-production-77ca1.up.railway.app`
- **Dev:** Goes to your new Railway dev URL

### Method 4: Visual Indicator (Optional)
Add a badge in footer or header showing environment.

---

## 📊 Quick Reference Table

| Environment | Frontend URL | Backend URL | Branch | Users |
|-------------|-------------|-------------|--------|-------|
| **Production** | esports-62sh.vercel.app | web-production-77ca1.up.railway.app | `main` | Live users |
| **Development** | esports-eciq.vercel.app | [Your Railway dev] | `dev` | Testing only |

---

## 🎯 Testing Checklist

### Production Check
```bash
# Open in browser
https://esports-62sh.vercel.app

# Should work perfectly
# Real users use this
```

### Dev Check
```bash
# Open in browser
https://esports-eciq.vercel.app

# For testing new features
# Can break without affecting users
```

---

## 🔧 Deployment Commands

### Deploy to Dev
```bash
git checkout dev
git add .
git commit -m "feat: new feature"
git push origin dev
# Deploys to: esports-eciq.vercel.app
```

### Deploy to Production
```bash
git checkout main
git merge dev
git push origin main
# Deploys to: esports-62sh.vercel.app
```

---

## 🚨 Emergency: If Confused

**Quick Test:**
1. Open both URLs in different tabs
2. Make a change on dev
3. Push to dev branch
4. Only dev URL should update
5. Production should remain unchanged

**If production breaks:**
1. Check Railway production logs
2. Check Vercel production deployment
3. Revert last commit on main branch
4. Redeploy

---

## 📝 Notes

- Always test on **dev** first
- Only merge to **main** when dev works perfectly
- Production should always be stable
- Dev can be broken during development

---

Last Updated: [Current Date]
