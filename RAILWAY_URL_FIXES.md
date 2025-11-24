# Railway URL Configuration Fixes

## Issues Found & Fixed

### Issue 1: tournamentSlice.js using relative URLs ❌
**Problem:** Axios was using relative URLs like `/api/tournaments` which rely on proxy in development but fail in production.

**Fixed:** Added `API_BASE_URL` constant and updated all axios calls to use absolute URLs.

```javascript
// Before
const response = await axios.get(`/api/tournaments?${params}`);

// After
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';
const response = await axios.get(`${API_BASE_URL}/api/tournaments?${params}`);
```

### Issue 2: socket.js using wrong port ❌
**Problem:** Socket.io was connecting to port 5000 but backend runs on 5001.

**Fixed:** Changed default port from 5000 to 5001.

```javascript
// Before
socket = io(process.env.REACT_APP_SERVER_URL || 'http://localhost:5000', {

// After
socket = io(process.env.REACT_APP_SERVER_URL || 'http://localhost:5001', {
```

## Current Environment Variable Configuration

### Development (.env)
```env
REACT_APP_API_URL=https://web-production-77ca1.up.railway.app/api
REACT_APP_SERVER_URL=https://web-production-77ca1.up.railway.app/
REACT_APP_CLIENT_URL=https://esports-62sh.vercel.app/
```

### Production (.env.production)
```env
REACT_APP_API_URL=https://web-production-77ca1.up.railway.app
REACT_APP_SERVER_URL=https://web-production-77ca1.up.railway.app
REACT_APP_CLIENT_URL=https://esports-62sh.vercel.app
```

## Files Using Railway URL Correctly ✅

1. **client/src/services/api.js** - Uses `process.env.REACT_APP_API_URL`
2. **client/src/utils/apiConfig.js** - Uses environment variables with fallbacks
3. **client/src/utils/socket.js** - Now uses correct port (5001)
4. **client/src/store/slices/tournamentSlice.js** - Now uses absolute URLs
5. **client/src/store/slices/walletSlice.js** - Uses `process.env.REACT_APP_API_URL`

## Deployment Steps

### Step 1: Commit Changes
```bash
git add .
git commit -m "fix: use Railway URL in all API calls"
git push
```

### Step 2: Redeploy Frontend on Vercel
```bash
cd client
vercel --prod
```

Or if using Git integration, Vercel will auto-deploy.

### Step 3: Verify Environment Variables on Vercel

Go to Vercel Dashboard → Your Project → Settings → Environment Variables

Ensure these are set:
```
REACT_APP_API_URL=https://web-production-77ca1.up.railway.app
REACT_APP_SERVER_URL=https://web-production-77ca1.up.railway.app
REACT_APP_CLIENT_URL=https://esports-62sh.vercel.app
REACT_APP_ENV=production
```

### Step 4: Test After Deployment

```powershell
# Test health endpoint
Invoke-WebRequest -Uri "https://web-production-77ca1.up.railway.app/api/health"

# Open frontend
start https://esports-62sh.vercel.app
```

## Important Notes

### ⚠️ Railway Backend Still Needs Environment Variables!

Even though frontend is fixed, **Railway backend still needs these variables:**

```
MONGODB_URI=mongodb+srv://colab_esports:qZgaDLfllrytAKqM@esports.zn4fbf9.mongodb.net/colab-esports
JWT_SECRET=colab_developers_amish_chandan12124545
CLIENT_URL=https://esports-62sh.vercel.app
NODE_ENV=production
```

**Without these, backend will still fail to connect to MongoDB!**

## Testing Checklist

After deployment:

- [ ] Frontend loads without errors
- [ ] Browser console shows no CORS errors
- [ ] API calls go to Railway URL (check Network tab)
- [ ] Socket.io connects to Railway backend
- [ ] Tournaments page loads data
- [ ] Homepage shows stats
- [ ] Login/Register works
- [ ] No "localhost" references in production

## Troubleshooting

### If still seeing localhost in production:
1. Clear browser cache (Ctrl+Shift+Delete)
2. Hard refresh (Ctrl+Shift+R)
3. Check Vercel environment variables
4. Redeploy Vercel

### If API calls fail:
1. Check Railway logs for errors
2. Verify Railway environment variables are set
3. Test Railway API directly with curl
4. Check CORS configuration in backend

### If Socket.io doesn't connect:
1. Check `REACT_APP_SERVER_URL` in Vercel
2. Verify Railway backend is running
3. Check browser console for connection errors
