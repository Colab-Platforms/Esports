# 🎮 BGMI Tournament Integration - Complete Guide

## Challenge: BGMI Limitations

BGMI doesn't have:
- ❌ Official API
- ❌ Server logs access
- ❌ Automated result tracking
- ❌ Direct integration support

## Solution: Manual + Semi-Automated System

### Architecture Overview

```
Tournament Registration
    ↓
Room ID/Password Generation
    ↓
Players Join Custom Room
    ↓
Match Plays
    ↓
Screenshot Upload (Players)
    ↓
Admin Verification
    ↓
Results Entry
    ↓
Leaderboard Update
```

---

## Phase 1: Tournament Flow

### Step 1: Registration System (Already Done! ✅)

Your existing registration collects:
- Team Name
- Leader Details (Name, Email, Phone, IGN, UID)
- Team Members (IGN, UID)

### Step 2: Room Details Generation

When tournament starts, admin creates custom room and shares details.

---

## Phase 2: Backend Implementation

### Match Model for BGMI


```javascript
// server/models/BGMIMatch.js
const mongoose = require('mongoose');

const bgmiMatchSchema = new mongoose.Schema({
  tournamentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tournament',
    required: true
  },
  matchNumber: Number,
  map: String,
  
  // Room Details
  roomId: String,
  roomPassword: String,
  
  // Match Status
  status: {
    type: String,
    enum: ['scheduled', 'active', 'completed', 'cancelled'],
    default: 'scheduled'
  },
  
  scheduledTime: Date,
  startTime: Date,
  endTime: Date,
  
  // Team Results (submitted by players/admin)
  teamResults: [{
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team'
    },
    teamName: String,
    placement: Number, // 1st, 2nd, 3rd, etc.
    kills: Number,
    points: Number,
    
    // Screenshot proof
    screenshots: [{
      url: String,
      uploadedBy: String,
      uploadedAt: Date
    }],
    
    // Verification
    verified: {
      type: Boolean,
      default: false
    },
    verifiedBy: String,
    verifiedAt: Date
  }],
  
  // Overall match stats
  totalTeams: Number,
  winner: String
}, {
  timestamps: true
});

module.exports = mongoose.model('BGMIMatch', bgmiMatchSchema);
```

### API Endpoints

```javascript
// server/routes/bgmiMatches.js
const express = require('express');
const router = express.Router();
const BGMIMatch = require('../models/BGMIMatch');
const multer = require('multer');
const path = require('path');

// Configure multer for screenshot uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/bgmi-screenshots/');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only images allowed'));
    }
  }
});

// Create match (Admin only)
router.post('/', auth, adminOnly, async (req, res) => {
  try {
    const match = new BGMIMatch(req.body);
    await match.save();
    
    res.json({
      success: true,
      data: { match }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating match'
    });
  }
});

// Upload screenshot (Players)
router.post('/:matchId/screenshot', auth, upload.single('screenshot'), async (req, res) => {
  try {
    const match = await BGMIMatch.findById(req.params.matchId);
    const { teamId, placement, kills } = req.body;
    
    // Find team result or create new
    let teamResult = match.teamResults.find(
      t => t.teamId.toString() === teamId
    );
    
    if (!teamResult) {
      teamResult = {
        teamId,
        placement: parseInt(placement),
        kills: parseInt(kills),
        screenshots: []
      };
      match.teamResults.push(teamResult);
    }
    
    // Add screenshot
    teamResult.screenshots.push({
      url: `/uploads/bgmi-screenshots/${req.file.filename}`,
      uploadedBy: req.user.id,
      uploadedAt: new Date()
    });
    
    await match.save();
    
    res.json({
      success: true,
      message: 'Screenshot uploaded successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error uploading screenshot'
    });
  }
});

// Submit results (Players)
router.post('/:matchId/submit-result', auth, async (req, res) => {
  try {
    const { teamId, placement, kills } = req.body;
    const match = await BGMIMatch.findById(req.params.matchId);
    
    // Calculate points based on placement and kills
    const points = calculateBGMIPoints(placement, kills);
    
    let teamResult = match.teamResults.find(
      t => t.teamId.toString() === teamId
    );
    
    if (teamResult) {
      teamResult.placement = placement;
      teamResult.kills = kills;
      teamResult.points = points;
    } else {
      match.teamResults.push({
        teamId,
        placement,
        kills,
        points
      });
    }
    
    await match.save();
    
    res.json({
      success: true,
      message: 'Result submitted successfully',
      data: { points }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error submitting result'
    });
  }
});

// Verify result (Admin only)
router.post('/:matchId/verify/:teamId', auth, adminOnly, async (req, res) => {
  try {
    const match = await BGMIMatch.findById(req.params.matchId);
    const teamResult = match.teamResults.find(
      t => t.teamId.toString() === req.params.teamId
    );
    
    if (teamResult) {
      teamResult.verified = true;
      teamResult.verifiedBy = req.user.id;
      teamResult.verifiedAt = new Date();
      
      await match.save();
      
      // Update leaderboard
      await updateLeaderboard(match.tournamentId, teamResult);
      
      res.json({
        success: true,
        message: 'Result verified successfully'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error verifying result'
    });
  }
});

// BGMI Points Calculation
function calculateBGMIPoints(placement, kills) {
  const placementPoints = {
    1: 10, 2: 6, 3: 5, 4: 4, 5: 3,
    6: 2, 7: 2, 8: 1, 9: 1, 10: 1
  };
  
  const basePoints = placementPoints[placement] || 0;
  const killPoints = kills * 1; // 1 point per kill
  
  return basePoints + killPoints;
}

// Update Leaderboard
async function updateLeaderboard(tournamentId, teamResult) {
  const Leaderboard = require('../models/Leaderboard');
  
  await Leaderboard.updateOne(
    { 
      tournamentId,
      teamId: teamResult.teamId
    },
    {
      $inc: {
        totalPoints: teamResult.points,
        totalKills: teamResult.kills,
        matchesPlayed: 1
      },
      $set: {
        lastUpdated: new Date()
      }
    },
    { upsert: true }
  );
}

module.exports = router;
```

---

## Phase 3: Frontend Components

### Result Submission Page

```javascript
// client/src/pages/BGMIResultSubmission.js
import React, { useState } from 'react';
import { useParams } from 'react-router-dom';

const BGMIResultSubmission = () => {
  const { matchId } = useParams();
  const [formData, setFormData] = useState({
    placement: '',
    kills: '',
    screenshot: null
  });
  const [preview, setPreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData({ ...formData, screenshot: file });
      setPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      // Upload screenshot first
      const formDataObj = new FormData();
      formDataObj.append('screenshot', formData.screenshot);
      formDataObj.append('teamId', localStorage.getItem('teamId'));
      formDataObj.append('placement', formData.placement);
      formDataObj.append('kills', formData.kills);

      const response = await fetch(`/api/bgmi-matches/${matchId}/screenshot`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formDataObj
      });

      const data = await response.json();

      if (data.success) {
        // Submit result
        await fetch(`/api/bgmi-matches/${matchId}/submit-result`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({
            teamId: localStorage.getItem('teamId'),
            placement: parseInt(formData.placement),
            kills: parseInt(formData.kills)
          })
        });

        alert('Result submitted successfully! Waiting for admin verification.');
      }
    } catch (error) {
      alert('Error submitting result');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gaming-dark p-6">
      <div className="max-w-2xl mx-auto">
        <div className="bg-gaming-charcoal rounded-lg p-6">
          <h1 className="text-2xl font-bold text-white mb-6">
            📊 Submit Match Result
          </h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Placement */}
            <div>
              <label className="block text-white mb-2">
                Team Placement (Rank) *
              </label>
              <select
                value={formData.placement}
                onChange={(e) => setFormData({ ...formData, placement: e.target.value })}
                className="w-full px-4 py-2 bg-gaming-dark border border-gray-600 rounded text-white"
                required
              >
                <option value="">Select Placement</option>
                {[...Array(20)].map((_, i) => (
                  <option key={i + 1} value={i + 1}>
                    #{i + 1}
                  </option>
                ))}
              </select>
            </div>

            {/* Kills */}
            <div>
              <label className="block text-white mb-2">
                Total Team Kills *
              </label>
              <input
                type="number"
                min="0"
                value={formData.kills}
                onChange={(e) => setFormData({ ...formData, kills: e.target.value })}
                className="w-full px-4 py-2 bg-gaming-dark border border-gray-600 rounded text-white"
                placeholder="Enter total kills"
                required
              />
            </div>

            {/* Screenshot Upload */}
            <div>
              <label className="block text-white mb-2">
                Result Screenshot *
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="w-full px-4 py-2 bg-gaming-dark border border-gray-600 rounded text-white"
                required
              />
              <p className="text-sm text-gray-400 mt-2">
                Upload clear screenshot showing final placement and kills
              </p>
            </div>

            {/* Preview */}
            {preview && (
              <div>
                <label className="block text-white mb-2">Preview:</label>
                <img 
                  src={preview} 
                  alt="Screenshot preview" 
                  className="w-full rounded border border-gray-600"
                />
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full btn-gaming disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Submit Result'}
            </button>
          </form>

          {/* Instructions */}
          <div className="mt-6 bg-blue-500/10 border border-blue-500/30 rounded p-4">
            <h3 className="text-blue-400 font-bold mb-2">📝 Instructions:</h3>
            <ul className="text-sm text-gray-300 space-y-1">
              <li>• Take clear screenshot of final result screen</li>
              <li>• Screenshot must show team placement and kills</li>
              <li>• Submit within 30 minutes of match end</li>
              <li>• Admin will verify and update leaderboard</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BGMIResultSubmission;
```

---

## Phase 4: Admin Panel

### Admin Verification Page

```javascript
// client/src/pages/admin/BGMIMatchVerification.js
import React, { useState, useEffect } from 'react';

const BGMIMatchVerification = ({ matchId }) => {
  const [match, setMatch] = useState(null);
  const [selectedTeam, setSelectedTeam] = useState(null);

  useEffect(() => {
    fetchMatchData();
  }, [matchId]);

  const fetchMatchData = async () => {
    const response = await fetch(`/api/bgmi-matches/${matchId}`);
    const data = await response.json();
    if (data.success) {
      setMatch(data.data.match);
    }
  };

  const handleVerify = async (teamId) => {
    const response = await fetch(
      `/api/bgmi-matches/${matchId}/verify/${teamId}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      }
    );

    if (response.ok) {
      alert('Result verified!');
      fetchMatchData();
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-white">
        Match Verification
      </h2>

      {match?.teamResults.map((team, i) => (
        <div key={i} className="bg-gaming-charcoal rounded-lg p-4">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-white font-bold">{team.teamName}</h3>
              <div className="text-sm text-gray-400">
                Placement: #{team.placement} | Kills: {team.kills} | Points: {team.points}
              </div>
            </div>
            {team.verified ? (
              <span className="px-3 py-1 bg-green-500 text-white rounded text-sm">
                ✓ Verified
              </span>
            ) : (
              <button
                onClick={() => handleVerify(team.teamId)}
                className="px-4 py-2 bg-gaming-neon text-black rounded font-bold"
              >
                Verify
              </button>
            )}
          </div>

          {/* Screenshots */}
          <div className="grid grid-cols-3 gap-2">
            {team.screenshots.map((ss, j) => (
              <img
                key={j}
                src={ss.url}
                alt="Result screenshot"
                className="w-full rounded cursor-pointer hover:opacity-80"
                onClick={() => window.open(ss.url, '_blank')}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default BGMIMatchVerification;
```

---

## Phase 5: Automated Leaderboard

### Leaderboard Model

```javascript
// server/models/BGMILeaderboard.js
const mongoose = require('mongoose');

const bgmiLeaderboardSchema = new mongoose.Schema({
  tournamentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tournament',
    required: true
  },
  teamId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    required: true
  },
  teamName: String,
  
  // Cumulative stats
  totalPoints: { type: Number, default: 0 },
  totalKills: { type: Number, default: 0 },
  matchesPlayed: { type: Number, default: 0 },
  
  // Best performance
  bestPlacement: Number,
  highestKills: Number,
  
  // Rankings
  currentRank: Number,
  previousRank: Number,
  
  lastUpdated: Date
}, {
  timestamps: true
});

// Auto-calculate rank before saving
bgmiLeaderboardSchema.pre('save', async function(next) {
  if (this.isModified('totalPoints')) {
    const leaderboard = await this.constructor.find({
      tournamentId: this.tournamentId
    }).sort({ totalPoints: -1 });
    
    leaderboard.forEach((entry, index) => {
      entry.currentRank = index + 1;
    });
  }
  next();
});

module.exports = mongoose.model('BGMILeaderboard', bgmiLeaderboardSchema);
```

---

## Complete Flow Summary

### 1. Tournament Creation
- Admin creates BGMI tournament
- Sets match schedule
- Generates room ID/password

### 2. Player Registration
- Teams register with IGN + UID
- System stores team details

### 3. Match Day
- Admin shares room details 30 min before
- Players join custom room
- Match plays

### 4. Result Submission
- Players upload screenshot
- Submit placement + kills
- System calculates points

### 5. Admin Verification
- Admin reviews screenshots
- Verifies results
- System updates leaderboard

### 6. Leaderboard Update
- Automatic rank calculation
- Points aggregation
- Real-time updates

---

## Alternative: Third-Party Integration

### Option 1: Use Tournament Platforms
- **Gamezop** - Has BGMI tournament API
- **Rooter** - Tournament management
- **GamerJi** - Esports platform

### Option 2: Manual Entry with Validation
- Players submit results
- Cross-verify with multiple screenshots
- Admin final approval

---

## Best Practices

✅ **Multiple Screenshots Required**
✅ **Time-limited Submission (30 min)**
✅ **Admin Verification Mandatory**
✅ **Dispute Resolution System**
✅ **Automated Point Calculation**
✅ **Real-time Leaderboard Updates**

---

Bhai, BGMI ke liye ye best approach hai! Fully automated nahi ho sakta but semi-automated system bahut effective hai! 🚀
