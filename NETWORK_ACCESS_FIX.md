# Network Access Fix - Access Website from Other Devices

## Problem
Website was accessible from other devices via IP address initially, but after some time:
- Data stopped loading
- API calls failed
- Errors appeared

## Root Cause
**Hardcoded `localhost:5001` URLs** in frontend code that don't work when accessing from other devices via IP address.

## Solution Implemented

### 1. Dynamic API URL Configuration
**File:** `client/src/utils/apiConfig.js`

Created utility functions that automatically detect the correct API URL:
- Uses `window.location.hostname` to detect current host
- Falls back to localhost for development
- Works with both localhost and IP addresses

```javascript
// Automatically returns correct URL based on how site is accessed
getApiBaseUrl()      // Returns: http://192.168.1.100:5001/api (when accessed via IP)
getServerBaseUrl()   // Returns: http://192.168.1.100:5001 (for OAuth)
getSteamAuthUrl()    // Returns: steam auth URL with correct host
```

### 2. Updated All Hardcoded URLs
Fixed in these files:
- ✅ `client/src/components/tournaments/TournamentRegistration.js`
- ✅ `client/src/pages/tournaments/SingleTournamentPage.js`
- ✅ `client/src/pages/CS2Page.js`
- ✅ `client/src/pages/HomePage.js`
- ✅ `client/src/components/steam/SteamConnectionModal.js`

### 3. Dynamic CORS Configuration
**File:** `server/index.js`

Updated CORS to accept requests from:
- `localhost:3000`
- Any IP address on port 3000 (e.g., `192.168.1.100:3000`)
- Mobile devices on same network

### 4. Environment Variables
**File:** `client/.env`

```env
REACT_APP_API_URL=http://localhost:5001/api
REACT_APP_SERVER_URL=http://localhost:5001
REACT_APP_CLIENT_URL=http://localhost:3000
```

## How to Access from Other Devices

### Step 1: Find Your Server IP
```bash
# Windows
ipconfig

# Look for IPv4 Address (e.g., 192.168.1.100)
```

### Step 2: Start Both Servers
```bash
# In server folder
npm run dev
```

This starts:
- Backend on `http://YOUR_IP:5001`
- Frontend on `http://YOUR_IP:3000`

### Step 3: Access from Other Device
On another device (phone, laptop) on same network:
```
http://192.168.1.100:3000
```

Replace `192.168.1.100` with your actual IP address.

## How It Works

### When Accessed via Localhost
```
Browser: http://localhost:3000
API calls go to: http://localhost:5001/api
✅ Works
```

### When Accessed via IP
```
Browser: http://192.168.1.100:3000
API calls go to: http://192.168.1.100:5001/api
✅ Works (automatically detected)
```

### When Accessed from Phone
```
Phone Browser: http://192.168.1.100:3000
API calls go to: http://192.168.1.100:5001/api
✅ Works (same network required)
```

## Testing

1. **On Development Machine:**
   ```
   http://localhost:3000
   ```
   Should work normally

2. **On Same Machine via IP:**
   ```
   http://192.168.1.100:3000
   ```
   Should work with all features

3. **On Another Device:**
   ```
   http://192.168.1.100:3000
   ```
   Should load tournaments, games, all data

## Troubleshooting

### Issue: Still seeing localhost errors
**Solution:** Clear browser cache and hard refresh (Ctrl+Shift+R)

### Issue: CORS errors
**Solution:** Check that both frontend and backend are running

### Issue: Can't access from phone
**Solution:** 
- Ensure phone is on same WiFi network
- Check Windows Firewall allows port 3000 and 5001
- Try disabling firewall temporarily for testing

### Issue: Steam OAuth not working from other device
**Solution:** Steam OAuth will redirect to localhost. This is expected - Steam authentication requires localhost for security.

## Firewall Configuration (Windows)

If you can't access from other devices, allow ports in Windows Firewall:

```powershell
# Allow port 3000 (Frontend)
netsh advfirewall firewall add rule name="React Dev Server" dir=in action=allow protocol=TCP localport=3000

# Allow port 5001 (Backend)
netsh advfirewall firewall add rule name="Node Backend" dir=in action=allow protocol=TCP localport=5001
```

## Production Deployment

For production, set environment variables:

```env
# .env (backend)
CLIENT_URL=https://yourdomain.com
SERVER_URL=https://api.yourdomain.com

# client/.env (frontend)
REACT_APP_API_URL=https://api.yourdomain.com/api
REACT_APP_SERVER_URL=https://api.yourdomain.com
REACT_APP_CLIENT_URL=https://yourdomain.com
```

## Benefits

✅ Works on localhost
✅ Works when accessed via IP address
✅ Works from other devices on same network
✅ No manual configuration needed
✅ Automatic URL detection
✅ Production-ready

## Summary

The fix makes the application **network-aware** - it automatically detects how it's being accessed and adjusts API URLs accordingly. No more hardcoded localhost URLs!
