# 🎮 Steam Integration Flow

## Overview
Steam integration allows users to connect their Steam accounts for CS2 tournaments. This document explains the complete flow.

---

## 🔄 Complete Flow

### 1. User Clicks "Join CS2 Tournament"
- User clicks on "JOIN NOW" button for a CS2 tournament
- System checks if user is authenticated
- If not authenticated → Redirect to login page

### 2. Steam Connection Check
- System checks if user has Steam ID connected (`user.gameIds.steam`)
- If Steam ID exists → Proceed to tournament registration
- If Steam ID missing → Show Steam connection dialog

### 3. Steam Connection Dialog
```
Steam account is required for "Tournament Name".

What will happen:
1. Steam app will open (if installed)
2. Browser will open for Steam login (required for security)
3. After login, you will return to tournament page

Note: Browser login is required by Steam for security.

Continue?
```

### 4. Steam App Launch (Optional)
- Try to open Steam desktop app using `steam://open/main`
- This is optional and may fail if Steam is not installed
- User experience: Steam app opens in background

### 5. Browser Redirect to Steam OAuth
After 1.5 seconds, redirect to:
```
http://localhost:5001/api/steam/auth?state={userId}&redirect=/tournaments/{tournamentId}
```

**Parameters:**
- `state`: User ID for security verification
- `redirect`: Where to return after successful authentication

### 6. Steam OAuth Login
- User is redirected to Steam's official login page
- User logs in with Steam credentials
- Steam validates user and returns authentication data

### 7. Backend Processing
**Route:** `GET /api/steam/auth/return`

Backend receives:
- Steam OpenID response
- User's Steam ID
- User's profile data

Backend actions:
1. Validates Steam response
2. Extracts Steam ID from OpenID URL
3. Fetches user profile from Steam API
4. Updates user document with Steam ID
5. Redirects back to tournament page

### 8. Return to Tournament
- User is redirected back to: `/tournaments/{tournamentId}`
- Steam ID is now saved in user profile
- User can now register for CS2 tournaments

---

## 🔐 Security Features

### State Parameter
- Contains user ID for verification
- Prevents CSRF attacks
- Validates that the returning user is the same who initiated the flow

### Steam OpenID
- Uses official Steam OpenID authentication
- No passwords are handled by our system
- Steam validates user identity

---

## 📡 API Endpoints

### 1. Initiate Steam Auth
```
GET /api/steam/auth
Query Parameters:
  - state: User ID (required)
  - redirect: Return URL path (optional)
```

### 2. Steam Callback
```
GET /api/steam/auth/return
Query Parameters:
  - openid.* : Steam OpenID response parameters
  - state: User ID from initial request
```

---

## 💾 Data Stored

### User Document Update
```javascript
{
  gameIds: {
    steam: "76561198XXXXXXXXX", // Steam ID 64
    steamProfile: {
      personaname: "PlayerName",
      avatarfull: "https://...",
      profileurl: "https://steamcommunity.com/id/..."
    }
  }
}
```

---

## 🎯 User Experience Flow

```
[User] → Click "Join CS2 Tournament"
   ↓
[System] → Check Authentication
   ↓
[System] → Check Steam Connection
   ↓
[Dialog] → Show Steam Connection Info
   ↓
[User] → Confirms
   ↓
[System] → Try Open Steam App (optional)
   ↓
[Browser] → Redirect to Steam OAuth
   ↓
[Steam] → User Logs In
   ↓
[Steam] → Returns to Backend
   ↓
[Backend] → Saves Steam ID
   ↓
[Browser] → Redirect to Tournament Page
   ↓
[User] → Can Now Register for Tournament
```

---

## 🛠️ Technical Implementation

### Frontend (HomePage.js)
```javascript
const openSteamForCS2 = (tournament) => {
  const userId = user?.id || user?._id;
  
  // Show confirmation dialog
  const userConfirmed = window.confirm('...');
  
  if (userConfirmed) {
    // Try to open Steam app
    const steamUrl = 'steam://open/main';
    const link = document.createElement('a');
    link.href = steamUrl;
    link.click();
    
    // Redirect to Steam OAuth
    setTimeout(() => {
      window.location.href = `http://localhost:5001/api/steam/auth?state=${userId}&redirect=/tournaments/${tournament.id}`;
    }, 1500);
  }
};
```

### Backend (steam.js routes)
```javascript
// Initiate Steam Auth
router.get('/auth', (req, res) => {
  const { state, redirect } = req.query;
  const returnUrl = `${process.env.BACKEND_URL}/api/steam/auth/return?state=${state}&redirect=${redirect}`;
  const steamLoginUrl = `https://steamcommunity.com/openid/login?...`;
  res.redirect(steamLoginUrl);
});

// Handle Steam Callback
router.get('/auth/return', async (req, res) => {
  // Validate Steam response
  // Extract Steam ID
  // Fetch Steam profile
  // Update user document
  // Redirect to frontend
});
```

---

## 🚨 Error Handling

### Steam App Not Installed
- Flow continues normally
- Only browser OAuth is required
- Steam app launch is optional enhancement

### Steam Login Cancelled
- User stays on Steam login page
- Can close browser tab
- No data is saved

### Invalid Steam Response
- Backend validates all Steam responses
- Returns error if validation fails
- User is redirected with error message

### Network Errors
- Backend handles API failures gracefully
- User sees error message
- Can retry the process

---

## 🔄 Re-authentication

### When is it needed?
- Never! Once Steam ID is saved, it's permanent
- User doesn't need to reconnect Steam for future tournaments

### Updating Steam Account
- Currently not supported
- Would require adding "Disconnect Steam" feature
- User would need to reconnect with new account

---

## 📝 Environment Variables Required

```env
# Steam API Configuration
STEAM_API_KEY=your_steam_api_key_here
STEAM_RETURN_URL=http://localhost:5001/api/steam/auth/return

# Backend URL
BACKEND_URL=http://localhost:5001

# Frontend URL
FRONTEND_URL=http://localhost:3001
```

---

## ✅ Testing Checklist

- [ ] User can click "Join CS2 Tournament"
- [ ] Confirmation dialog appears
- [ ] Steam app opens (if installed)
- [ ] Browser redirects to Steam login
- [ ] User can log in with Steam
- [ ] Steam ID is saved to user profile
- [ ] User is redirected back to tournament
- [ ] User can now register for tournament
- [ ] Error handling works for all failure cases

---

## 🎮 Supported Games

Currently only CS2 requires Steam authentication:
- ✅ CS2 (Counter-Strike 2)
- ❌ BGMI (No Steam required)
- ❌ Valorant (No Steam required)
- ❌ Free Fire (No Steam required)

---

## 📚 References

- [Steam Web API Documentation](https://steamcommunity.com/dev)
- [Steam OpenID Documentation](https://steamcommunity.com/dev)
- [Steam URL Protocols](https://developer.valvesoftware.com/wiki/Steam_browser_protocol)
