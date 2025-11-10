# 🎮 CS2 Dedicated Server Setup Guide for Tournament Platform

## Overview
This guide will help you set up a CS2 dedicated server that can host multiple tournaments through your platform.

---

## 📋 Prerequisites

### System Requirements (Minimum)
- **OS:** Ubuntu 20.04+ / Windows Server 2019+
- **CPU:** 4 cores (Intel/AMD)
- **RAM:** 8GB minimum (16GB recommended)
- **Storage:** 50GB SSD
- **Network:** 100 Mbps upload/download
- **Ports:** 27015 (game), 27020 (SourceTV), 27005 (client)

### Recommended Providers
1. **AWS EC2** - t3.xlarge or c5.xlarge
2. **Google Cloud** - n2-standard-4
3. **DigitalOcean** - CPU-Optimized 8GB
4. **OVH** - Game servers
5. **Hetzner** - Dedicated servers

**Cost:** $50-150/month depending on provider

---

## 🚀 Quick Setup (Linux - Ubuntu)

### Step 1: Install SteamCMD

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install dependencies
sudo apt install -y lib32gcc-s1 lib32stdc++6 curl wget

# Create steam user
sudo useradd -m -s /bin/bash steam
sudo passwd steam

# Switch to steam user
sudo su - steam

# Download and install SteamCMD
mkdir ~/steamcmd
cd ~/steamcmd
wget https://steamcdn-a.akamaihd.net/client/installer/steamcmd_linux.tar.gz
tar -xvzf steamcmd_linux.tar.gz
```

### Step 2: Install CS2 Server

```bash
# Run SteamCMD
./steamcmd.sh

# Login anonymously
login anonymous

# Set install directory
force_install_dir /home/steam/cs2-server

# Install CS2 dedicated server
app_update 730 validate

# Exit SteamCMD
quit
```

### Step 3: Configure Server

```bash
cd /home/steam/cs2-server/game/csgo/cfg

# Create server.cfg
nano server.cfg
```

**server.cfg content:**
```cfg
// Server Name
hostname "Colab Esports Tournament Server"

// RCON Password (for remote management)
rcon_password "your_secure_rcon_password_here"

// Server Password (empty for public, set for private tournaments)
sv_password ""

// Game Settings
sv_cheats 0
sv_lan 0
sv_region 5  // 5 = Asia

// Match Settings
mp_autoteambalance 0
mp_limitteams 0
mp_maxrounds 30
mp_roundtime 1.92
mp_freezetime 15
mp_buytime 20
mp_startmoney 800
mp_maxmoney 16000

// Tournament Mode
mp_overtime_enable 1
mp_overtime_maxrounds 6
mp_overtime_startmoney 10000

// Server Performance
sv_maxrate 0
sv_minrate 196608
sv_mincmdrate 64
sv_maxcmdrate 128
sv_minupdaterate 64
sv_maxupdaterate 128
tickrate 128

// Logging
log on
sv_logbans 1
sv_logecho 1
sv_logfile 1
sv_log_onefile 0
```

### Step 4: Create Start Script

```bash
cd /home/steam/cs2-server

# Create start script
nano start_server.sh
```

**start_server.sh content:**
```bash
#!/bin/bash

# CS2 Server Start Script
cd /home/steam/cs2-server

./game/bin/linuxsteamrt64/cs2 \
  -dedicated \
  -console \
  -usercon \
  -port 27015 \
  +map de_dust2 \
  +game_type 0 \
  +game_mode 1 \
  +mapgroup mg_active \
  +sv_setsteamaccount YOUR_GAME_SERVER_LOGIN_TOKEN \
  -tickrate 128 \
  +exec server.cfg
```

```bash
# Make executable
chmod +x start_server.sh
```

### Step 5: Get Game Server Login Token

1. Go to: https://steamcommunity.com/dev/managegameservers
2. Login with your Steam account
3. App ID: **730** (CS2)
4. Memo: "Colab Esports Tournament Server"
5. Copy the token
6. Replace `YOUR_GAME_SERVER_LOGIN_TOKEN` in start_server.sh

### Step 6: Start Server

```bash
./start_server.sh
```

---

## 🔧 Integration with Your Platform

### Database Schema Update

Add server details to Tournament model:

```javascript
// server/models/Tournament.js

const tournamentSchema = new mongoose.Schema({
  // ... existing fields ...
  
  serverDetails: {
    type: {
      serverIp: String,
      serverPort: { type: Number, default: 27015 },
      rconPassword: String,
      serverPassword: String,  // For private tournaments
      connectCommand: String,  // steam://connect/IP:PORT/password
      sourcetvPort: { type: Number, default: 27020 },
      sourcetvPassword: String
    },
    required: false
  }
});
```

### Backend API Endpoints

```javascript
// server/routes/tournaments.js

// Get server details for registered users
router.get('/:id/server-details', auth, async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.id);
    
    // Check if user is registered
    const isRegistered = tournament.participants.some(
      p => p.userId.toString() === req.user.id
    );
    
    if (!isRegistered) {
      return res.status(403).json({
        success: false,
        message: 'You must be registered to view server details'
      });
    }
    
    // Only show server details 30 minutes before tournament
    const now = new Date();
    const startTime = new Date(tournament.startDate);
    const timeDiff = startTime - now;
    const minutesUntilStart = timeDiff / (1000 * 60);
    
    if (minutesUntilStart > 30) {
      return res.status(403).json({
        success: false,
        message: `Server details will be available 30 minutes before tournament start`,
        availableAt: new Date(startTime.getTime() - 30 * 60000)
      });
    }
    
    res.json({
      success: true,
      data: {
        serverIp: tournament.serverDetails.serverIp,
        serverPort: tournament.serverDetails.serverPort,
        serverPassword: tournament.serverDetails.serverPassword,
        connectCommand: tournament.serverDetails.connectCommand,
        sourcetvPort: tournament.serverDetails.sourcetvPort,
        map: tournament.map || 'de_dust2'
      }
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching server details'
    });
  }
});
```

### Frontend Display (SingleTournamentPage)

```javascript
// Show server details after registration
{isUserRegistered && tournament.gameType === 'cs2' && (
  <div className="bg-gaming-card rounded-lg border border-gaming-border p-6">
    <h3 className="text-lg font-bold text-white mb-4">
      🖥️ Server Details
    </h3>
    
    {serverDetailsAvailable ? (
      <div className="space-y-3">
        <div className="flex justify-between">
          <span className="text-gray-400">Server IP:</span>
          <span className="text-white font-mono">{serverDetails.serverIp}</span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-gray-400">Port:</span>
          <span className="text-white font-mono">{serverDetails.serverPort}</span>
        </div>
        
        {serverDetails.serverPassword && (
          <div className="flex justify-between">
            <span className="text-gray-400">Password:</span>
            <span className="text-white font-mono">{serverDetails.serverPassword}</span>
          </div>
        )}
        
        <div className="mt-4">
          <button
            onClick={() => {
              navigator.clipboard.writeText(serverDetails.connectCommand);
              alert('Connect command copied!');
            }}
            className="w-full btn-gaming"
          >
            📋 Copy Connect Command
          </button>
          
          <button
            onClick={() => {
              window.location.href = serverDetails.connectCommand;
            }}
            className="w-full btn-primary mt-2"
          >
            🎮 Launch CS2 & Connect
          </button>
        </div>
        
        <div className="mt-4 p-3 bg-gaming-charcoal rounded">
          <p className="text-xs text-gray-400 mb-2">Manual Connect:</p>
          <code className="text-xs text-gaming-gold break-all">
            {serverDetails.connectCommand}
          </code>
        </div>
      </div>
    ) : (
      <div className="text-center py-4">
        <p className="text-gray-400">
          Server details will be available 30 minutes before tournament start
        </p>
        <p className="text-sm text-gray-500 mt-2">
          Available at: {availableTime}
        </p>
      </div>
    )}
  </div>
)}
```

---

## 🎯 Tournament Management

### RCON Commands (Remote Control)

Install RCON tool:
```bash
npm install -g rcon-cli
```

**Useful Commands:**
```bash
# Change map
rcon -H YOUR_SERVER_IP -p 27015 -P YOUR_RCON_PASSWORD "changelevel de_mirage"

# Kick player
rcon -H YOUR_SERVER_IP -p 27015 -P YOUR_RCON_PASSWORD "kickid STEAM_ID"

# Restart match
rcon -H YOUR_SERVER_IP -p 27015 -P YOUR_RCON_PASSWORD "mp_restartgame 1"

# Pause match
rcon -H YOUR_SERVER_IP -p 27015 -P YOUR_RCON_PASSWORD "mp_pause_match"

# Unpause match
rcon -H YOUR_SERVER_IP -p 27015 -P YOUR_RCON_PASSWORD "mp_unpause_match"
```

### Automated Match Setup

Create a Node.js service to manage matches:

```javascript
// server/services/cs2MatchService.js

const Rcon = require('rcon-client').Rcon;

class CS2MatchService {
  constructor(serverIp, serverPort, rconPassword) {
    this.serverIp = serverIp;
    this.serverPort = serverPort;
    this.rconPassword = rconPassword;
  }
  
  async connect() {
    this.rcon = await Rcon.connect({
      host: this.serverIp,
      port: this.serverPort,
      password: this.rconPassword
    });
  }
  
  async setupMatch(tournament) {
    await this.connect();
    
    // Set server password
    await this.rcon.send(`sv_password ${tournament.serverPassword}`);
    
    // Load map
    await this.rcon.send(`changelevel ${tournament.map}`);
    
    // Configure match settings
    await this.rcon.send('mp_warmup_start');
    await this.rcon.send('mp_warmuptime 300');
    
    // Set team names
    await this.rcon.send(`mp_teamname_1 "${tournament.team1Name}"`);
    await this.rcon.send(`mp_teamname_2 "${tournament.team2Name}"`);
    
    this.rcon.end();
  }
  
  async startMatch() {
    await this.connect();
    await this.rcon.send('mp_warmup_end');
    await this.rcon.send('mp_restartgame 1');
    this.rcon.end();
  }
  
  async endMatch() {
    await this.connect();
    await this.rcon.send('sv_password ""');
    this.rcon.end();
  }
}

module.exports = CS2MatchService;
```

---

## 💰 Cost Breakdown

### Monthly Costs:
- **Server Hosting:** $50-150/month
- **Steam Game Server Token:** FREE
- **Bandwidth:** Usually included
- **Backup Storage:** $5-10/month (optional)

### One-Time Costs:
- **Initial Setup:** 2-4 hours of work
- **Configuration:** Included in guide

---

## 🔒 Security Best Practices

1. **Strong RCON Password:** Use 20+ character random password
2. **Firewall Rules:** Only allow necessary ports
3. **Regular Updates:** Keep CS2 server updated
4. **Backup Configs:** Daily backups of server configs
5. **Monitor Logs:** Check for suspicious activity
6. **DDoS Protection:** Use Cloudflare or similar

---

## 📊 Monitoring & Maintenance

### Install Monitoring Tools:

```bash
# Install htop for resource monitoring
sudo apt install htop

# Install netstat for network monitoring
sudo apt install net-tools
```

### Create Monitoring Script:

```bash
#!/bin/bash
# monitor_server.sh

while true; do
  echo "=== CS2 Server Status ==="
  echo "Time: $(date)"
  
  # Check if server is running
  if pgrep -x "cs2" > /dev/null; then
    echo "Status: RUNNING ✓"
    
    # Show player count
    PLAYERS=$(rcon -H localhost -p 27015 -P YOUR_RCON_PASSWORD "status" | grep "players" | awk '{print $3}')
    echo "Players: $PLAYERS"
  else
    echo "Status: STOPPED ✗"
    echo "Attempting restart..."
    /home/steam/cs2-server/start_server.sh &
  fi
  
  echo "========================"
  sleep 60
done
```

---

## 🎮 Multiple Tournaments Support

### Option 1: Multiple Servers (Recommended)
- Run multiple CS2 instances on different ports
- Each tournament gets dedicated server
- Better performance and isolation

```bash
# Server 1 (Port 27015)
./start_server.sh

# Server 2 (Port 27016)
./game/bin/linuxsteamrt64/cs2 -dedicated -port 27016 +map de_mirage

# Server 3 (Port 27017)
./game/bin/linuxsteamrt64/cs2 -dedicated -port 27017 +map de_inferno
```

### Option 2: Single Server with Scheduling
- Use one server for multiple tournaments
- Schedule tournaments at different times
- More cost-effective but limited capacity

---

## 📝 Admin Panel Integration

Create admin panel to manage servers:

```javascript
// Admin can:
// 1. View server status
// 2. Start/stop matches
// 3. Change maps
// 4. Kick players
// 5. View logs
// 6. Configure settings

// Example API endpoint
router.post('/admin/server/command', adminAuth, async (req, res) => {
  const { command } = req.body;
  
  const matchService = new CS2MatchService(
    process.env.CS2_SERVER_IP,
    process.env.CS2_SERVER_PORT,
    process.env.CS2_RCON_PASSWORD
  );
  
  await matchService.connect();
  const result = await matchService.rcon.send(command);
  await matchService.rcon.end();
  
  res.json({ success: true, result });
});
```

---

## 🚨 Troubleshooting

### Server Won't Start
```bash
# Check logs
tail -f /home/steam/cs2-server/csgo/logs/console.log

# Verify ports are open
sudo netstat -tulpn | grep 27015

# Check firewall
sudo ufw status
```

### Players Can't Connect
```bash
# Verify server is public
sv_lan 0

# Check server password
sv_password ""

# Verify Steam token is valid
sv_setsteamaccount YOUR_TOKEN
```

### Poor Performance
```bash
# Increase tickrate
-tickrate 128

# Optimize network settings
sv_maxrate 0
sv_minrate 196608
```

---

## 📚 Additional Resources

- **CS2 Server Documentation:** https://developer.valvesoftware.com/wiki/Counter-Strike_2/Dedicated_Servers
- **SteamCMD Wiki:** https://developer.valvesoftware.com/wiki/SteamCMD
- **RCON Protocol:** https://developer.valvesoftware.com/wiki/Source_RCON_Protocol
- **Community Forums:** https://forums.alliedmods.net/

---

## ✅ Quick Checklist

- [ ] Server hardware meets requirements
- [ ] SteamCMD installed
- [ ] CS2 server installed
- [ ] Game Server Login Token obtained
- [ ] server.cfg configured
- [ ] Firewall ports opened (27015, 27020, 27005)
- [ ] RCON password set
- [ ] Start script created
- [ ] Server tested and accessible
- [ ] Database schema updated
- [ ] API endpoints created
- [ ] Frontend integration complete
- [ ] Monitoring setup
- [ ] Backup system in place

---

## 🎯 Next Steps

1. **Set up your first server** following this guide
2. **Test with friends** before going live
3. **Create admin panel** for easy management
4. **Set up automated backups**
5. **Monitor performance** and optimize
6. **Scale up** as tournaments grow

Good luck with your CS2 tournament platform! 🚀
