# 🎮 CS2 Server Log Integration with MERN Platform

## Your Existing Setup (PHP)

### Current Architecture:
```
CS2 Server (Hostinger)
    ↓
Cron Job (Every 1 minute)
    ↓
Copy Logs → Temp File
    ↓
checkpoint.txt (Track last processed line)
    ↓
PHP Script → Parse Logs
    ↓
Insert to Database
```

**Perfect! This is a solid foundation.** 🎯

---

## Integration Strategy

### Option 1: Direct Database Integration (Recommended)

Since you already have log processing working, we just need to connect it to your MERN platform's MongoDB.

#### Step 1: Update PHP Script to Use MongoDB

**Install MongoDB PHP Driver:**
```bash
# On your Hostinger server
composer require mongodb/mongodb
```

**PHP Script Update:**
```php
<?php
// config.php
require 'vendor/autoload.php';

$mongoClient = new MongoDB\Client("mongodb+srv://colab_esports:7HgZ7ApfEPWrabx9@esports.zn4fbf9.mongodb.net/");
$db = $mongoClient->selectDatabase('colab-esports');
$matchesCollection = $db->selectCollection('matches');
$playersCollection = $db->selectCollection('players');

// log_processor.php
function processCS2Logs($logFile, $checkpointFile) {
    global $matchesCollection, $playersCollection;
    
    // Read checkpoint
    $lastLine = file_exists($checkpointFile) ? (int)file_get_contents($checkpointFile) : 0;
    
    // Read new logs
    $logs = file($logFile);
    $newLogs = array_slice($logs, $lastLine);
    
    foreach ($newLogs as $lineNum => $log) {
        $parsedData = parseLogLine($log);
        
        if ($parsedData) {
            // Insert to MongoDB
            if ($parsedData['type'] === 'kill') {
                $matchesCollection->updateOne(
                    ['matchId' => $parsedData['matchId']],
                    [
                        '$push' => [
                            'events' => [
                                'type' => 'kill',
                                'killer' => $parsedData['killer'],
                                'victim' => $parsedData['victim'],
                                'weapon' => $parsedData['weapon'],
                                'timestamp' => new MongoDB\BSON\UTCDateTime()
                            ]
                        ]
                    ],
                    ['upsert' => true]
                );
            }
            
            // Update player stats
            updatePlayerStats($parsedData);
        }
        
        // Update checkpoint
        file_put_contents($checkpointFile, $lastLine + $lineNum + 1);
    }
}

function parseLogLine($log) {
    // Your existing log parsing logic
    // Example: "Player1<STEAM_ID> killed Player2<STEAM_ID> with ak47"
    
    if (preg_match('/(.+)<(.+)> killed (.+)<(.+)> with (.+)/', $log, $matches)) {
        return [
            'type' => 'kill',
            'matchId' => getCurrentMatchId(),
            'killer' => [
                'name' => $matches[1],
                'steamId' => $matches[2]
            ],
            'victim' => [
                'name' => $matches[3],
                'steamId' => $matches[4]
            ],
            'weapon' => $matches[5]
        ];
    }
    
    return null;
}

function updatePlayerStats($data) {
    global $playersCollection;
    
    if ($data['type'] === 'kill') {
        // Update killer stats
        $playersCollection->updateOne(
            ['steamId' => $data['killer']['steamId']],
            [
                '$inc' => ['kills' => 1],
                '$set' => ['lastSeen' => new MongoDB\BSON\UTCDateTime()]
            ],
            ['upsert' => true]
        );
        
        // Update victim stats
        $playersCollection->updateOne(
            ['steamId' => $data['victim']['steamId']],
            [
                '$inc' => ['deaths' => 1],
                '$set' => ['lastSeen' => new MongoDB\BSON\UTCDateTime()]
            ],
            ['upsert' => true]
        );
    }
}

// Run processor
processCS2Logs('/path/to/logs/console.log', '/path/to/checkpoint.txt');
?>
```

---

### Option 2: API Integration (More Flexible)

Keep your PHP script as is, but send data to your MERN backend via API.

#### PHP Script with API Calls:

```php
<?php
// api_sender.php

function sendToMERNBackend($data) {
    $url = 'https://your-domain.com/api/matches/log-event';
    
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'Authorization: Bearer YOUR_API_KEY'
    ]);
    
    $response = curl_exec($ch);
    curl_close($ch);
    
    return json_decode($response, true);
}

// Process logs and send to API
function processAndSendLogs($logFile, $checkpointFile) {
    $lastLine = file_exists($checkpointFile) ? (int)file_get_contents($checkpointFile) : 0;
    $logs = file($logFile);
    $newLogs = array_slice($logs, $lastLine);
    
    foreach ($newLogs as $lineNum => $log) {
        $parsedData = parseLogLine($log);
        
        if ($parsedData) {
            // Send to MERN backend
            $result = sendToMERNBackend($parsedData);
            
            if ($result['success']) {
                // Update checkpoint only if successful
                file_put_contents($checkpointFile, $lastLine + $lineNum + 1);
            }
        }
    }
}

processAndSendLogs('/path/to/logs/console.log', '/path/to/checkpoint.txt');
?>
```

#### MERN Backend API Endpoint:

```javascript
// server/routes/matches.js

const express = require('express');
const router = express.Router();
const Match = require('../models/Match');
const Player = require('../models/Player');

// Middleware to verify API key
const verifyApiKey = (req, res, next) => {
  const apiKey = req.headers.authorization?.replace('Bearer ', '');
  
  if (apiKey !== process.env.CS2_LOG_API_KEY) {
    return res.status(401).json({ success: false, message: 'Invalid API key' });
  }
  
  next();
};

// Receive log events from PHP script
router.post('/log-event', verifyApiKey, async (req, res) => {
  try {
    const { type, matchId, killer, victim, weapon, timestamp } = req.body;
    
    // Find or create match
    let match = await Match.findOne({ matchId });
    
    if (!match) {
      match = new Match({
        matchId,
        tournamentId: req.body.tournamentId,
        status: 'active',
        events: []
      });
    }
    
    // Add event
    match.events.push({
      type,
      killer,
      victim,
      weapon,
      timestamp: timestamp || new Date()
    });
    
    await match.save();
    
    // Update player stats
    if (type === 'kill') {
      await Player.updateOne(
        { steamId: killer.steamId },
        { 
          $inc: { kills: 1 },
          $set: { lastSeen: new Date() }
        },
        { upsert: true }
      );
      
      await Player.updateOne(
        { steamId: victim.steamId },
        { 
          $inc: { deaths: 1 },
          $set: { lastSeen: new Date() }
        },
        { upsert: true }
      );
    }
    
    res.json({ success: true, message: 'Event logged successfully' });
    
  } catch (error) {
    console.error('Error logging event:', error);
    res.status(500).json({ success: false, message: 'Error logging event' });
  }
});

module.exports = router;
```

---

## Database Schema for Match Events

```javascript
// server/models/Match.js

const matchSchema = new mongoose.Schema({
  matchId: {
    type: String,
    required: true,
    unique: true
  },
  tournamentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tournament'
  },
  status: {
    type: String,
    enum: ['waiting', 'active', 'completed', 'cancelled'],
    default: 'waiting'
  },
  startTime: Date,
  endTime: Date,
  map: String,
  
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
    }
  }],
  
  // Final scores
  teamScores: {
    team1: { type: Number, default: 0 },
    team2: { type: Number, default: 0 }
  },
  
  // Player statistics
  playerStats: [{
    steamId: String,
    name: String,
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

## Cron Job Configuration

Your existing cron job can stay the same:

```bash
# Crontab entry (runs every minute)
* * * * * /usr/bin/php /path/to/log_processor.php >> /path/to/logs/processor.log 2>&1
```

---

## Real-time Updates to Frontend

Use Socket.IO to push live updates to frontend:

```javascript
// server/index.js

io.on('connection', (socket) => {
  console.log('Client connected for live match updates');
  
  socket.on('join-match', (matchId) => {
    socket.join(`match-${matchId}`);
  });
});

// In your match event handler
router.post('/log-event', verifyApiKey, async (req, res) => {
  // ... save to database ...
  
  // Emit to connected clients
  io.to(`match-${matchId}`).emit('match-event', {
    type: req.body.type,
    data: req.body
  });
  
  res.json({ success: true });
});
```

```javascript
// Frontend - client/src/pages/LiveMatchPage.js

import { useEffect, useState } from 'react';
import io from 'socket.io-client';

const LiveMatchPage = ({ matchId }) => {
  const [events, setEvents] = useState([]);
  
  useEffect(() => {
    const socket = io('http://localhost:5001');
    
    socket.emit('join-match', matchId);
    
    socket.on('match-event', (event) => {
      setEvents(prev => [...prev, event]);
      
      // Show notification
      if (event.type === 'kill') {
        showKillFeed(event.data);
      }
    });
    
    return () => socket.disconnect();
  }, [matchId]);
  
  return (
    <div>
      <h2>Live Match</h2>
      <div className="kill-feed">
        {events.map((event, i) => (
          <div key={i}>
            {event.data.killer.name} killed {event.data.victim.name} with {event.data.weapon}
          </div>
        ))}
      </div>
    </div>
  );
};
```

---

## Environment Variables

Add to `.env`:

```env
# CS2 Log Processing
CS2_LOG_API_KEY=your-secure-api-key-here
CS2_SERVER_IP=your-hostinger-server-ip
```

---

## Testing the Integration

### 1. Test PHP to MongoDB Connection:
```php
<?php
require 'vendor/autoload.php';

$client = new MongoDB\Client("your-mongodb-uri");
$db = $client->selectDatabase('colab-esports');

// Test insert
$result = $db->selectCollection('test')->insertOne([
    'test' => 'data',
    'timestamp' => new MongoDB\BSON\UTCDateTime()
]);

echo "Inserted ID: " . $result->getInsertedId();
?>
```

### 2. Test API Endpoint:
```bash
curl -X POST http://localhost:5001/api/matches/log-event \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "type": "kill",
    "matchId": "test-match-1",
    "killer": {"name": "Player1", "steamId": "STEAM_123"},
    "victim": {"name": "Player2", "steamId": "STEAM_456"},
    "weapon": "ak47"
  }'
```

---

## Advantages of Your Setup

✅ **Already Working** - No need to rebuild from scratch
✅ **Reliable** - Cron job ensures logs are processed
✅ **Checkpoint System** - Prevents duplicate processing
✅ **Scalable** - Can handle multiple matches simultaneously

---

## Next Steps

1. **Choose Integration Method:**
   - Option 1: Direct MongoDB (faster, less overhead)
   - Option 2: API calls (more flexible, easier to debug)

2. **Update PHP Script** with chosen method

3. **Test with Sample Logs**

4. **Deploy to Production**

5. **Monitor Performance**

---

## Monitoring & Debugging

```bash
# Check cron job logs
tail -f /path/to/logs/processor.log

# Check checkpoint file
cat /path/to/checkpoint.txt

# Monitor MongoDB inserts
# In MongoDB Atlas, check "Metrics" tab
```

---

Bhai, tumhara existing setup perfect hai! Bas MongoDB connection add karna hai aur sab kaam karega! 🚀
