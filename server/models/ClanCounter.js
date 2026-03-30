const mongoose = require('mongoose');

const clanCounterSchema = new mongoose.Schema({
  _id: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  
  seq: {
    type: Number,
    default: 0
  }
});

// Static method to get next sequence number for a clan
clanCounterSchema.statics.getNextSeq = async function(clanId) {
  try {
    const result = await this.findOneAndUpdate(
      { _id: clanId },
      { $inc: { seq: 1 } },
      { 
        new: true,
        upsert: true,
        setDefaultsOnInsert: true
      }
    );
    
    return result.seq;
  } catch (error) {
    console.error('❌ Error getting next sequence:', error);
    throw new Error(`Failed to get next sequence for clan ${clanId}`);
  }
};

// Static method to reset counter for a clan
clanCounterSchema.statics.resetSeq = async function(clanId) {
  try {
    await this.findOneAndUpdate(
      { _id: clanId },
      { seq: 0 },
      { upsert: true }
    );
    
    console.log(`✅ Reset sequence counter for clan ${clanId}`);
  } catch (error) {
    console.error('❌ Error resetting sequence:', error);
    throw new Error(`Failed to reset sequence for clan ${clanId}`);
  }
};

// Static method to get current seq without incrementing
clanCounterSchema.statics.getCurrentSeq = async function(clanId) {
  try {
    const counter = await this.findById(clanId);
    return counter ? counter.seq : 0;
  } catch (error) {
    console.error('❌ Error getting current sequence:', error);
    throw new Error(`Failed to get current sequence for clan ${clanId}`);
  }
};

module.exports = mongoose.model('ClanCounter', clanCounterSchema);
