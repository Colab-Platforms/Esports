const Clan = require('../models/Clan');
const ClanMember = require('../models/ClanMember');
const ClanMessage = require('../models/ClanMessage');
const ClanCounter = require('../models/ClanCounter');
const User = require('../models/User');

class ClanService {
  /**
   * Create a new clan
   * @param {Object} clanData - Clan data
   * @param {String} clanData.name - Clan name
   * @param {String} clanData.tag - Clan tag (optional)
   * @param {String} clanData.description - Clan description (optional)
   * @param {String} clanData.owner - Owner user ID
   * @param {String} clanData.visibility - Visibility level (public/private/invite)
   * @returns {Promise<Object>} Created clan
   */
  static async createClan(clanData) {
    try {
      const clan = new Clan({
        ...clanData,
        stats: {
          totalMembers: 1,
          totalMessages: 0,
          createdTournaments: 0
        }
      });

      await clan.save();

      // Add owner as clan member with owner role
      const clanMember = new ClanMember({
        clan: clan._id,
        user: clanData.owner,
        role: 'owner'
      });

      await clanMember.save();

      console.log(`✅ Clan "${clan.name}" created successfully`);
      return clan;
    } catch (error) {
      console.error('❌ Error creating clan:', error);
      throw error;
    }
  }

  /**
   * Add member to clan
   * @param {String} clanId - Clan ID
   * @param {String} userId - User ID to add
   * @param {String} role - Member role (default: 'member')
   * @returns {Promise<Object>} Created clan member
   */
  static async addMember(clanId, userId, role = 'member') {
    try {
      const clan = await Clan.findById(clanId);
      if (!clan) throw new Error('Clan not found');

      // Check if user is banned
      if (clan.isBanned(userId)) {
        throw new Error('User is banned from this clan');
      }

      // Check if clan is full
      if (clan.stats.totalMembers >= clan.maxMembers) {
        throw new Error('Clan is full');
      }

      // Check if user is already a member
      const existingMember = await ClanMember.findOne({ clan: clanId, user: userId });
      if (existingMember) {
        throw new Error('User is already a member of this clan');
      }

      const clanMember = new ClanMember({
        clan: clanId,
        user: userId,
        role
      });

      await clanMember.save();

      // Update clan member count
      clan.stats.totalMembers += 1;
      await clan.save();

      console.log(`✅ User ${userId} added to clan ${clanId}`);
      return clanMember;
    } catch (error) {
      console.error('❌ Error adding member to clan:', error);
      throw error;
    }
  }

  /**
   * Remove member from clan
   * @param {String} clanId - Clan ID
   * @param {String} userId - User ID to remove
   * @returns {Promise<void>}
   */
  static async removeMember(clanId, userId) {
    try {
      const clan = await Clan.findById(clanId);
      if (!clan) throw new Error('Clan not found');

      const clanMember = await ClanMember.findOneAndDelete({ clan: clanId, user: userId });
      if (!clanMember) throw new Error('Member not found in clan');

      // Update clan member count
      clan.stats.totalMembers = Math.max(0, clan.stats.totalMembers - 1);
      await clan.save();

      console.log(`✅ User ${userId} removed from clan ${clanId}`);
    } catch (error) {
      console.error('❌ Error removing member from clan:', error);
      throw error;
    }
  }

  /**
   * Send message to clan
   * @param {String} clanId - Clan ID
   * @param {String} senderId - Sender user ID
   * @param {String} content - Message content
   * @param {String} replyTo - Reply to message ID (optional)
   * @returns {Promise<Object>} Created message
   */
  static async sendMessage(clanId, senderId, content, replyTo = null) {
    try {
      const clan = await Clan.findById(clanId);
      if (!clan) throw new Error('Clan not found');

      // Check if sender is a member
      const member = await ClanMember.findOne({ clan: clanId, user: senderId });
      if (!member) throw new Error('User is not a member of this clan');

      // Check if member is muted
      if (member.isMuted()) {
        throw new Error(`User is muted until ${member.mutedUntil}`);
      }

      // Get next sequence number
      const seq = await ClanCounter.getNextSeq(clanId);

      const message = new ClanMessage({
        clan: clanId,
        sender: senderId,
        content,
        replyTo: replyTo || null,
        seq
      });

      await message.save();

      // Update clan message count
      clan.stats.totalMessages += 1;
      await clan.save();

      // Update member stats
      member.stats.messagesCount += 1;
      member.stats.lastMessageAt = new Date();
      await member.save();

      console.log(`✅ Message sent to clan ${clanId}`);
      return message;
    } catch (error) {
      console.error('❌ Error sending message:', error);
      throw error;
    }
  }

  /**
   * Get clan messages with pagination
   * @param {String} clanId - Clan ID
   * @param {Number} page - Page number (default: 1)
   * @param {Number} limit - Messages per page (default: 50)
   * @returns {Promise<Object>} Messages and pagination info
   */
  static async getMessages(clanId, page = 1, limit = 50) {
    try {
      const skip = (page - 1) * limit;

      const messages = await ClanMessage.find({ clan: clanId, isDeleted: false })
        .populate('sender', 'username avatarUrl')
        .populate('replyTo', 'content sender')
        .sort({ seq: -1 })
        .skip(skip)
        .limit(limit);

      const total = await ClanMessage.countDocuments({ clan: clanId, isDeleted: false });

      return {
        messages: messages.reverse(), // Return in ascending order
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      console.error('❌ Error fetching messages:', error);
      throw error;
    }
  }

  /**
   * Get pinned messages
   * @param {String} clanId - Clan ID
   * @returns {Promise<Array>} Pinned messages
   */
  static async getPinnedMessages(clanId) {
    try {
      const messages = await ClanMessage.find({ clan: clanId, isPinned: true, isDeleted: false })
        .populate('sender', 'username avatarUrl')
        .sort({ createdAt: -1 });

      return messages;
    } catch (error) {
      console.error('❌ Error fetching pinned messages:', error);
      throw error;
    }
  }

  /**
   * Get clan members
   * @param {String} clanId - Clan ID
   * @param {Number} page - Page number (default: 1)
   * @param {Number} limit - Members per page (default: 50)
   * @returns {Promise<Object>} Members and pagination info
   */
  static async getMembers(clanId, page = 1, limit = 50) {
    try {
      const skip = (page - 1) * limit;

      const members = await ClanMember.find({ clan: clanId })
        .populate('user', 'username email avatarUrl level')
        .sort({ role: 1, joinedAt: -1 })
        .skip(skip)
        .limit(limit);

      const total = await ClanMember.countDocuments({ clan: clanId });

      return {
        members,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      console.error('❌ Error fetching members:', error);
      throw error;
    }
  }

  /**
   * Update member role
   * @param {String} clanId - Clan ID
   * @param {String} userId - User ID
   * @param {String} newRole - New role
   * @returns {Promise<Object>} Updated member
   */
  static async updateMemberRole(clanId, userId, newRole) {
    try {
      const member = await ClanMember.findOneAndUpdate(
        { clan: clanId, user: userId },
        { role: newRole },
        { new: true }
      );

      if (!member) throw new Error('Member not found');

      console.log(`✅ Updated ${userId} role to ${newRole} in clan ${clanId}`);
      return member;
    } catch (error) {
      console.error('❌ Error updating member role:', error);
      throw error;
    }
  }

  /**
   * Mute member
   * @param {String} clanId - Clan ID
   * @param {String} userId - User ID
   * @param {Number} durationMs - Mute duration in milliseconds
   * @returns {Promise<Object>} Updated member
   */
  static async muteMember(clanId, userId, durationMs) {
    try {
      const member = await ClanMember.findOne({ clan: clanId, user: userId });
      if (!member) throw new Error('Member not found');

      await member.mute(durationMs);

      console.log(`✅ Muted user ${userId} in clan ${clanId} for ${durationMs}ms`);
      return member;
    } catch (error) {
      console.error('❌ Error muting member:', error);
      throw error;
    }
  }

  /**
   * Delete clan
   * @param {String} clanId - Clan ID
   * @returns {Promise<void>}
   */
  static async deleteClan(clanId) {
    try {
      // Delete all clan members
      await ClanMember.deleteMany({ clan: clanId });

      // Delete all clan messages
      await ClanMessage.deleteMany({ clan: clanId });

      // Delete clan counter
      await ClanCounter.deleteOne({ _id: clanId });

      // Delete clan
      await Clan.findByIdAndDelete(clanId);

      console.log(`✅ Clan ${clanId} deleted successfully`);
    } catch (error) {
      console.error('❌ Error deleting clan:', error);
      throw error;
    }
  }
}

module.exports = ClanService;
