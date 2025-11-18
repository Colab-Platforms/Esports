# 🎮 CS2 Log Integration - Step by Step Guide

## Phase 1: Backend Setup (MERN Platform)

### Step 1: Create Match Model

Create file: `server/models/Match.js`

```javascript
const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema({
  matchId: {
    type: String,
    required: true,
    unique: true
  },
  tournamentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tournament',
    required: true
  },
  status: {
    type: String,
    enum: ['waiting', 'active', 'completed', 'cancelled'],
    default: 'waiting'
  },
  startTime: Date,
  endTime: Date,
  map: String,
  serverIp: String,
  
  // Real-time events from logs
  events: [{
    type: {
      type: String,
      enum: ['kill', 'death', 'assist', 'bomb_plant', 'bomb_defuse', 'round_end', 'match_end']
    },
    killer: {
      name: String,
      steamId: String
    },
    victim: {
      name: String,
      steamId: String
    },
    weapon: String,
    timestamp: {
      type: Date,
      default: Date.now
    },
    roundNumber: Number
  }],
  
  // Team scores
  teamScores: {
    team1: { type: Number, default: 0 },
    team2: { type: Number, default: 0 }
  },
  
  // Player statistics
  playerStats: [{
    steamId: String,
    name: String,
    team: Number,
    kills: { type: Number, default: 0 },
    deaths: { type: Number, default: 0 },
    assists: { type: Number, default: 0 },
    mvps: { type: Number, default: 0 },
    score: { type: Number, default: 0 }
  }]
}, {
  timestamps: true
});

module.exports = mongoose.model('Match', matchSchema);
```

---

### Step 2: Create Match Routes

Create file: `server/routes/matches.js`

```javascript
const express = require('express');
const router = express.Router();
const Match = require('../models/Match');

// Middleware to verify API key from PHP script
const verifyApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey || apiKey !== process.env.CS2_LOG_API_KEY) {
    return res.status(401).json({ 
      success: false, 
      message: 'Invalid API key' 
    });
  }
  
  next();
};

// Receive log events from PHP script
router.post('/log-event', verifyApiKey, async (req, res) => {
  try {
    const { 
      type, 
      matchId, 
      tournamentId,
      killer, 
      victim, 
      weapon, 
      roundNumber 
    } = req.body;
    
    console.log('📥 Received log event:', { type, matchId });
    
    // Find or create match
    let match = await Match.findOne({ matchId });
    
    if (!match) {
      match = new Match({
        matchId,
        tournamentId,
        status: 'active',
        startTime: new Date(),
        events: []
      });
    }
    
    // Add event
    match.events.push({
      type,
      killer,
      victim,
      weapon,
      roundNumber,
      timestamp: new Date()
    });
    
    // Update player stats if kill event
    if (type === 'kill' && killer && victim) {
      // Update killer stats
      let killerStats = match.playerStats.find(p => p.steamId === killer.steamId);
      if (!killerStats) {
        killerStats = {
          steamId: killer.steamId,
          name: killer.name,
          kills: 0,
          deaths: 0,
          assists: 0
        };
        match.playerStats.push(killerStats);
      }
      killerStats.kills += 1;
      
      // Update victim stats
      let victimStats = match.playerStats.find(p => p.steamId === victim.steamId);
      if (!victimStats) {
        victimStats = {
          steamId: victim.steamId,
          name: victim.name,
          kills: 0,
          deaths: 0,
          assists: 0
        };
        match.playerStats.push(victimStats);
      }
      victimStats.deaths += 1;
    }
    
    // Update match status
    if (type === 'match_end') {
      match.status = 'completed';
      match.endTime = new Date();
    }
    
    await match.save();
    
    // Emit to Socket.IO for real-time updates
    if (req.app.get('io')) {
      req.app.get('io').to(`match-${matchId}`).emit('match-event', {
        type,
        data: req.body,
        timestamp: new Date()
      });
    }
    
    res.json({ 
      success: true, 
      message: 'Event logged successfully',
      matchId: match.matchId
    });
    
  } catch (error) {
    console.error('❌ Error logging event:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error logging event',
      error: error.message 
    });
  }
});

// Get match details
router.get('/:matchId', async (req, res) => {
  try {
    const match = await Match.findOne({ matchId: req.params.matchId })
      .populate('tournamentId');
    
    if (!match) {
      return res.status(404).json({
        success: false,
        message: 'Match not found'
      });
    }
    
    res.json({
      success: true,
      data: { match }
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching match'
    });
  }
});

// Get live match events (for frontend)
router.get('/:matchId/events', async (req, res) => {
  try {
    const match = await Match.findOne({ matchId: req.params.matchId });
    
    if (!match) {
      return res.status(404).json({
        success: false,
        message: 'Match not found'
      });
    }
    
    res.json({
      success: true,
      data: {
        events: match.events,
        playerStats: match.playerStats,
        teamScores: match.teamScores,
        status: match.status
      }
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching match events'
    });
  }
});

module.exports = router;
```

---

### Step 3: Update server/index.js

Add these lines to `server/index.js`:

```javascript
// After other route imports
const matchRoutes = require('./routes/matches');

// After other route uses
app.use('/api/matches', matchRoutes);

// Make io available to routes
app.set('io', io);

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('👤 Client connected for live updates');
  
  socket.on('join-match', (matchId) => {
    socket.join(`match-${matchId}`);
    console.log(`👤 Client joined match: ${matchId}`);
  });
  
  socket.on('leave-match', (matchId) => {
    socket.leave(`match-${matchId}`);
    console.log(`👤 Client left match: ${matchId}`);
  });
  
  socket.on('disconnect', () => {
    console.log('👤 Client disconnected');
  });
});
```

---

### Step 4: Add Environment Variable

Add to `.env` file:

```env
# CS2 Log Processing API Key
CS2_LOG_API_KEY=your-super-secret-api-key-12345
```

**Generate a secure API key:**
```bash
# Run this in terminal to generate random key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Phase 2: PHP Script Setup (Hostinger Server)

### Step 5: Create PHP Log Processor

Create file on your Hostinger server: `/home/your-username/cs2-logs/log_processor.php`

```php
<?php
// Configuration
define('API_URL', 'https://your-domain.com/api/matches/log-event');
define('API_KEY', 'your-super-secret-api-key-12345'); // Same as in .env
define('LOG_FILE', '/path/to/cs2/server/csgo/logs/console.log');
define('CHECKPOINT_FILE', '/home/your-username/cs2-logs/checkpoint.txt');
define('TOURNAMENT_ID', '6789abcd1234567890abcdef'); // Your tournament MongoDB ID

// Read checkpoint
function getLastProcessedLine() {
    if (file_exists(CHECKPOINT_FILE)) {
        return (int)file_get_contents(CHECKPOINT_FILE);
    }
    return 0;
}

// Update checkpoint
function updateCheckpoint($lineNumber) {
    file_put_contents(CHECKPOINT_FILE, $lineNumber);
}

// Parse CS2 log line
function parseLogLine($log) {
    $result = null;
    
    // Kill event: "Player1<STEAM_ID> killed Player2<STEAM_ID> with ak47"
    if (preg_match('/"(.+)<(\d+)><(STEAM_[^>]+)><([^>]+)>" killed "(.+)<(\d+)><(STEAM_[^>]+)><([^>]+)>" with "([^"]+)"/', $log, $matches)) {
        $result = [
            'type' => 'kill',
            'killer' => [
                'name' => $matches[1],
                'steamId' => $matches[3]
            ],
            'victim' => [
                'name' => $matches[5],
                'steamId' => $matches[7]
            ],
            'weapon' => $matches[9]
        ];
    }
    
    // Round end: "Team CT scored X with Y players"
    elseif (preg_match('/Team (CT|TERRORIST) scored (\d+)/', $log, $matches)) {
        $result = [
            'type' => 'round_end',
            'team' => $matches[1],
            'score' => (int)$matches[2]
        ];
    }
    
    // Match end
    elseif (strpos($log, 'Game Over') !== false) {
        $result = [
            'type' => 'match_end'
        ];
    }
    
    return $result;
}

// Send data to MERN backend
function sendToBackend($data) {
    $ch = curl_init(API_URL);
    
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode($data),
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'X-API-Key: ' . API_KEY
        ],
        CURLOPT_TIMEOUT => 10
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($httpCode === 200) {
        $result = json_decode($response, true);
        return $result['success'] ?? false;
    }
    
    return false;
}

// Generate match ID from timestamp
function getCurrentMatchId() {
    static $matchId = null;
    if ($matchId === null) {
        $matchId = 'match_' . date('Ymd_His');
    }
    return $matchId;
}

// Main processing function
function processLogs() {
    if (!file_exists(LOG_FILE)) {
        echo "❌ Log file not found: " . LOG_FILE . "\n";
        return;
    }
    
    $lastLine = getLastProcessedLine();
    $logs = file(LOG_FILE);
    $totalLines = count($logs);
    
    if ($lastLine >= $totalLines) {
        echo "✅ No new logs to process\n";
        return;
    }
    
    $newLogs = array_slice($logs, $lastLine);
    $processedCount = 0;
    $errorCount = 0;
    
    echo "📊 Processing " . count($newLogs) . " new log lines...\n";
    
    foreach ($newLogs as $index => $log) {
        $currentLine = $lastLine + $index;
        $parsedData = parseLogLine($log);
        
        if ($parsedData) {
            // Add common fields
            $parsedData['matchId'] = getCurrentMatchId();
            $parsedData['tournamentId'] = TOURNAMENT_ID;
            $parsedData['timestamp'] = date('c');
            
            // Send to backend
            if (sendToBackend($parsedData)) {
                $processedCount++;
                echo "✅ Sent {$parsedData['type']} event\n";
            } else {
                $errorCount++;
                echo "❌ Failed to send {$parsedData['type']} event\n";
            }
        }
        
        // Update checkpoint after each line
        updateCheckpoint($currentLine + 1);
    }
    
    echo "📊 Summary: Processed $processedCount events, $errorCount errors\n";
}

// Run the processor
try {
    echo "🚀 Starting CS2 log processor...\n";
    echo "📁 Log file: " . LOG_FILE . "\n";
    echo "📍 Checkpoint: " . CHECKPOINT_FILE . "\n";
    echo "🌐 API URL: " . API_URL . "\n";
    echo "---\n";
    
    processLogs();
    
    echo "---\n";
    echo "✅ Processing complete!\n";
    
} catch (Exception $e) {
    echo "❌ Error: " . $e->getMessage() . "\n";
    exit(1);
}
?>
```

---

### Step 6: Test PHP Script Manually

```bash
# SSH into your Hostinger server
ssh your-username@your-server-ip

# Navigate to script directory
cd /home/your-username/cs2-logs

# Run manually to test
php log_processor.php
```

**Expected output:**
```
🚀 Starting CS2 log processor...
📁 Log file: /path/to/logs/console.log
📍 Checkpoint: /home/your-username/cs2-logs/checkpoint.txt
🌐 API URL: https://your-domain.com/api/matches/log-event
---
📊 Processing 150 new log lines...
✅ Sent kill event
✅ Sent kill event
✅ Sent round_end event
---
✅ Processing complete!
```

---

### Step 7: Setup Cron Job

```bash
# Edit crontab
crontab -e

# Add this line (runs every minute)
* * * * * /usr/bin/php /home/your-username/cs2-logs/log_processor.php >> /home/your-username/cs2-logs/processor.log 2>&1
```

**Check cron logs:**
```bash
tail -f /home/your-username/cs2-logs/processor.log
```

---

## Phase 3: Frontend Integration

### Step 8: Create Live Match Page

Create file: `client/src/pages/LiveMatchPage.js`

```javascript
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import io from 'socket.io-client';

const LiveMatchPage = () => {
  const { matchId } = useParams();
  const [events, setEvents] = useState([]);
  const [playerStats, setPlayerStats] = useState([]);
  const [teamScores, setTeamScores] = useState({ team1: 0, team2: 0 });
  const [matchStatus, setMatchStatus] = useState('waiting');
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    // Fetch initial match data
    fetchMatchData();

    // Connect to Socket.IO
    const newSocket = io('http://localhost:5001');
    setSocket(newSocket);

    newSocket.emit('join-match', matchId);

    newSocket.on('match-event', (event) => {
      console.log('📥 Received event:', event);
      
      // Add to events list
      setEvents(prev => [...prev, event].slice(-50)); // Keep last 50 events
      
      // Refresh match data
      fetchMatchData();
    });

    return () => {
      newSocket.emit('leave-match', matchId);
      newSocket.disconnect();
    };
  }, [matchId]);

  const fetchMatchData = async () => {
    try {
      const response = await fetch(`/api/matches/${matchId}/events`);
      const data = await response.json();
      
      if (data.success) {
        setPlayerStats(data.data.playerStats);
        setTeamScores(data.data.teamScores);
        setMatchStatus(data.data.status);
      }
    } catch (error) {
      console.error('Error fetching match data:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gaming-dark p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-gaming-charcoal rounded-lg p-6 mb-6">
          <h1 className="text-3xl font-bold text-white mb-2">
            🔴 Live Match: {matchId}
          </h1>
          <div className="flex items-center space-x-4">
            <span className={`px-3 py-1 rounded-full text-sm font-bold ${
              matchStatus === 'active' ? 'bg-red-500 text-white animate-pulse' :
              matchStatus === 'completed' ? 'bg-green-500 text-white' :
              'bg-gray-500 text-white'
            }`}>
              {matchStatus.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Team Scores */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          <div className="bg-gaming-charcoal rounded-lg p-6 text-center">
            <h3 className="text-gray-400 mb-2">Team 1</h3>
            <div className="text-5xl font-bold text-gaming-neon">
              {teamScores.team1}
            </div>
          </div>
          <div className="bg-gaming-charcoal rounded-lg p-6 text-center">
            <h3 className="text-gray-400 mb-2">Team 2</h3>
            <div className="text-5xl font-bold text-gaming-neon">
              {teamScores.team2}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Kill Feed */}
          <div className="lg:col-span-2 bg-gaming-charcoal rounded-lg p-6">
            <h2 className="text-xl font-bold text-white mb-4">
              🎯 Kill Feed
            </h2>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {events.filter(e => e.type === 'kill').reverse().map((event, i) => (
                <div key={i} className="bg-gaming-dark rounded p-3 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-white font-bold">
                      {event.data.killer?.name}
                    </span>
                    <span className="text-gray-400">killed</span>
                    <span className="text-red-400 font-bold">
                      {event.data.victim?.name}
                    </span>
                  </div>
                  <span className="text-gaming-gold text-sm">
                    {event.data.weapon}
                  </span>
                </div>
              ))}
              {events.filter(e => e.type === 'kill').length === 0 && (
                <div className="text-center text-gray-400 py-8">
                  Waiting for match events...
                </div>
              )}
            </div>
          </div>

          {/* Player Stats */}
          <div className="bg-gaming-charcoal rounded-lg p-6">
            <h2 className="text-xl font-bold text-white mb-4">
              📊 Player Stats
            </h2>
            <div className="space-y-2">
              {playerStats.sort((a, b) => b.kills - a.kills).map((player, i) => (
                <div key={i} className="bg-gaming-dark rounded p-3">
                  <div className="text-white font-bold mb-1">
                    {player.name}
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-green-400">K: {player.kills}</span>
                    <span className="text-red-400">D: {player.deaths}</span>
                    <span className="text-yellow-400">A: {player.assists}</span>
                  </div>
                </div>
              ))}
              {playerStats.length === 0 && (
                <div className="text-center text-gray-400 py-8">
                  No player stats yet
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveMatchPage;
```

---

### Step 9: Add Route

In `client/src/App.js`, add:

```javascript
import LiveMatchPage from './pages/LiveMatchPage';

// In your routes
<Route path="/match/:matchId/live" element={<LiveMatchPage />} />
```

---

## Phase 4: Testing

### Step 10: Test Complete Flow

1. **Start Backend:**
```bash
npm run server
```

2. **Start Frontend:**
```bash
cd client && npm start
```

3. **Trigger Test Event from PHP:**
```bash
# On Hostinger server
php log_processor.php
```

4. **Check Backend Logs:**
```
📥 Received log event: { type: 'kill', matchId: 'match_20250110_143022' }
```

5. **Open Frontend:**
```
http://localhost:3000/match/match_20250110_143022/live
```

6. **You should see:**
- Live kill feed updating
- Player stats updating
- Team scores updating

---

## Troubleshooting

### Issue 1: API Key Error
```
❌ Failed to send kill event
```
**Solution:** Check API key matches in both `.env` and PHP script

### Issue 2: No Events Showing
```bash
# Check if events are being sent
tail -f /home/your-username/cs2-logs/processor.log

# Check backend logs
# Look for "📥 Received log event"
```

### Issue 3: Socket.IO Not Connecting
```javascript
// Check browser console for errors
// Make sure backend URL is correct in LiveMatchPage.js
```

---

## Next Steps

1. ✅ Complete Phase 1 (Backend)
2. ✅ Complete Phase 2 (PHP Script)
3. ✅ Complete Phase 3 (Frontend)
4. ✅ Test everything
5. 🚀 Deploy to production

---

Bhai, ye complete step-by-step guide hai! Ek ek step follow karo aur test karte jao! 🚀
