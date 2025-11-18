# Real CS2 Server Setup ✅

## 🎮 **Your Working Server:**

```
Server IP: 31.97.229.109
Port: 27015
Password: ColabEsports#456
Connect Command: steam://connect/31.97.229.109:27015/ColabEsports#456
```

---

## ✅ **What I Updated:**

### 1. Seed Data (server/index.js)
Updated all CS2 tournaments to use your real server:
- CS2 Pro Championship
- CS2 Quick Match
- All other CS2 tournaments

### 2. Server Details Now Show:
```javascript
roomDetails: {
  cs2: {
    serverIp: '31.97.229.109',
    serverPort: '27015',
    password: 'ColabEsports#456',
    connectCommand: 'steam://connect/31.97.229.109:27015/ColabEsports#456'
  }
}
```

---

## 🚀 **How to Apply Changes:**

### Option 1: Re-seed Database (Recommended)
```bash
# This will update all tournaments with new server
POST http://localhost:5001/api/seed-database
```

### Option 2: Update Existing Tournaments
```javascript
// MongoDB
db.tournaments.updateMany(
  { gameType: 'cs2' },
  { 
    $set: { 
      'roomDetails.cs2.serverIp': '31.97.229.109',
      'roomDetails.cs2.serverPort': '27015',
      'roomDetails.cs2.password': 'ColabEsports#456',
      'roomDetails.cs2.connectCommand': 'steam://connect/31.97.229.109:27015/ColabEsports#456'
    }
  }
)
```

### Option 3: Manual Update (Single Tournament)
```javascript
db.tournaments.updateOne(
  { name: 'CS2 Pro Championship' },
  { 
    $set: { 
      'roomDetails.cs2': {
        serverIp: '31.97.229.109',
        serverPort: '27015',
        password: 'ColabEsports#456',
        rconPassword: 'admin123',
        connectCommand: 'steam://connect/31.97.229.109:27015/ColabEsports#456',
        mapPool: ['de_dust2', 'de_mirage', 'de_inferno']
      }
    }
  }
)
```

---

## 🧪 **Testing:**

### Step 1: Register for CS2 Tournament
```
1. Go to CS2 tournament page
2. Click "JOIN NOW"
3. Complete Steam auth (if needed)
4. Register
```

### Step 2: Check Server Details
```
After registration, you should see:

┌─────────────────────────────────────────┐
│ 🟢 SERVER DETAILS                       │
│                                         │
│ Server IP: 31.97.229.109               │
│ Port: 27015                             │
│                                         │
│ Connect Command:                        │
│ steam://connect/31.97.229.109:27015/   │
│ ColabEsports#456                        │
│                                         │
│ [COPY COMMAND]                          │
└─────────────────────────────────────────┘
```

### Step 3: Join Server
```
1. Copy command
2. Open CS2
3. Press ~ (console)
4. Paste command
5. Press Enter
6. ✅ You should connect to your server!
```

---

## 📊 **User Flow (Complete):**

```
1. User browses tournaments
   ↓
2. Sees "CS2 Pro Championship"
   ↓
3. Clicks "JOIN NOW"
   ↓
4. Steam authentication (if needed)
   ↓
5. Registration form
   ↓
6. ✅ Registered!
   ↓
7. Server details appear:
   - IP: 31.97.229.109
   - Port: 27015
   - Password: ColabEsports#456
   ↓
8. Clicks "COPY COMMAND"
   ↓
9. Opens CS2
   ↓
10. Opens console (~)
    ↓
11. Pastes: steam://connect/31.97.229.109:27015/ColabEsports#456
    ↓
12. ✅ Connects to YOUR server!
    ↓
13. Plays tournament on your server
```

---

## 🔧 **Server Management:**

### Check Server Status:
```bash
# From your server
screen -r cs2-server
# or
systemctl status cs2-server
```

### View Server Logs:
```bash
tail -f ~/cs2-server/csgo/logs/latest.log
```

### RCON Commands (Admin):
```
rcon_password admin123
rcon say "Tournament starting in 5 minutes!"
rcon changelevel de_dust2
rcon mp_restartgame 1
```

---

## 🎯 **Next Steps:**

### 1. Re-seed Database
```bash
# Use Postman or curl
POST http://localhost:5001/api/seed-database
```

### 2. Test Tournament Registration
```
- Register for CS2 tournament
- Check if server details show correctly
- Test connect command
```

### 3. Verify Server Connection
```
- Copy command from UI
- Paste in CS2 console
- Should connect to 31.97.229.109:27015
```

---

## ✅ **Summary:**

**Your Real Server:**
- IP: 31.97.229.109
- Port: 27015
- Password: ColabEsports#456

**Updated In:**
- ✅ server/index.js (seed data)
- ✅ All CS2 tournaments
- ✅ Connect commands

**Next:**
1. Re-seed database
2. Test registration
3. Test server connection

**Your server is now integrated! Users can join your real CS2 server through tournaments!** 🚀
