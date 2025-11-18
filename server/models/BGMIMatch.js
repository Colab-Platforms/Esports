const mongoose = require('mongoose');

const bgmiMatchSchema = new mongoose.Schema({
  tournamentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tournament',
    required: true
  },
  matchNumber: {
    type: Number,
    required: true
  },
  map: {
    type: String,
    enum: ['Erangel', 'Miramar', 'Sanhok', 'Vikendi', 'Livik'],
    default: 'Erangel'
  },
  
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
  
  // Team Results
  teamResults: [{
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team'
    },
    teamName: String,
    placement: Number,
    kills: Number,
    points: Number,
    
    // Screenshot proof
    screenshots: [{
      url: String,
      uploadedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      uploadedAt: {
        type: Date,
        default: Date.now
      }
    }],
    
    // Verification
    verified: {
      type: Boolean,
      default: false
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    verifiedAt: Date,
    
    // Submission time
    submittedAt: Date
  }],
  
  // Match settings
  totalTeams: Number,
  winner: String,
  
  // Notes
  adminNotes: String
}, {
  timestamps: true
});

// Calculate points based on BGMI scoring
bgmiMatchSchema.methods.calculatePoints = function(placement, kills) {
  const placementPoints = {
    1: 10, 2: 6, 3: 5, 4: 4, 5: 3,
    6: 2, 7: 2, 8: 1, 9: 1, 10: 1
  };
  
  const basePoints = placementPoints[placement] || 0;
  const killPoints = kills * 1;
  
  return basePoints + killPoints;
};

module.exports = mongoose.model('BGMIMatch', bgmiMatchSchema);
