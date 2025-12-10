const express = require('express');
const router = express.Router();
const Tournament = require('../models/Tournament');

// Update CS2 tournaments status (active/inactive)
router.post('/update-cs2-status', async (req, res) => {
  try {
    const { status = 'active', tournamentId } = req.body;
    
    // Validate status for CS2
    if (!['active', 'inactive'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Invalid status. CS2 tournaments can only be "active" or "inactive"'
        }
      });
    }
    
    console.log(`🔄 Updating CS2 tournament statuses to ${status}...`);
    
    // Build query - specific tournament or all CS2 tournaments
    const query = { gameType: 'cs2' };
    if (tournamentId) {
      query._id = tournamentId;
    }
    
    // Update CS2 tournaments status
    const result = await Tournament.updateMany(
      query,
      { 
        $set: { 
          status: status
        }
      }
    );
    
    console.log(`✅ Updated ${result.modifiedCount} CS2 tournaments to ${status} status`);
    
    // Get updated tournaments
    const updatedTournaments = await Tournament.find({ gameType: 'cs2' });
    
    res.json({
      success: true,
      message: `Updated ${result.modifiedCount} CS2 tournaments to ${status}`,
      data: {
        modifiedCount: result.modifiedCount,
        status: status,
        tournaments: updatedTournaments.map(t => ({
          id: t._id,
          name: t.name,
          status: t.status,
          gameType: t.gameType
        }))
      }
    });
    
  } catch (error) {
    console.error('❌ Error updating CS2 status:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to update CS2 tournament statuses',
        details: error.message
      }
    });
  }
});

module.exports = router;