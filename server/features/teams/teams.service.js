const Team = require('./team.model');
const TeamInvitation = require('./team-invitation.model');
const User = require('../../models/User');
const Notification = require('../../models/Notification');
const TournamentRegistration = require('../../models/TournamentRegistration');
const verifiedGameIdService = require('../../services/auth/verified-game-id.service');
const { TEAM_POPULATE_FIELDS } = require('./teams.constants');

const createError = (code, message, status = 400) => {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
};

const populateTeamFull = async (team) => {
  await team.populate('captain', TEAM_POPULATE_FIELDS);
  await team.populate('members.userId', TEAM_POPULATE_FIELDS);
  return team;
};

const buildGameInfoUpdate = async (userId, game, info) => {
  const update = {};

  if (info.ign !== undefined || info.uid !== undefined) {
    if (game === 'bgmi') {
      const existing = await User.findById(userId).select('gameIds bgmiIgnName bgmiUid').lean();
      const existingBgmi = typeof existing?.gameIds?.bgmi === 'object' ? existing.gameIds.bgmi : {};
      update['gameIds.bgmi'] = {
        ign: info.ign !== undefined ? info.ign : (existingBgmi.ign || existing?.bgmiIgnName || ''),
        uid: info.uid !== undefined ? info.uid : (existingBgmi.uid || existing?.bgmiUid || '')
      };
      if (info.ign !== undefined) update.bgmiIgnName = info.ign;
      if (info.uid !== undefined) update.bgmiUid = info.uid;
    } else if (game === 'freefire') {
      const existing = await User.findById(userId).select('gameIds freeFireIgnName freeFireUid').lean();
      const existingFf = typeof existing?.gameIds?.freefire === 'object' ? existing.gameIds.freefire : {};
      update['gameIds.freefire'] = {
        ign: info.ign !== undefined ? info.ign : (existingFf.ign || existing?.freeFireIgnName || ''),
        uid: info.uid !== undefined ? info.uid : (existingFf.uid || existing?.freeFireUid || '')
      };
      if (info.ign !== undefined) update.freeFireIgnName = info.ign;
      if (info.uid !== undefined) update.freeFireUid = info.uid;
    }
  }

  if (info.steamId !== undefined) update['gameIds.steam'] = info.steamId;
  await verifiedGameIdService.applyUntrustedValorantUpdate(userId, update, info.valorantId);

  return update;
};

const applyGameInfoUpdate = async (userId, game, info) => {
  if (!info || !userId) return;
  const update = await buildGameInfoUpdate(userId, game, info);
  if (Object.keys(update).length > 0) {
    await User.findByIdAndUpdate(userId, { $set: update });
  }
};

const createTeam = async (userId, data) => {
  const { name, tag, game, logo, description, maxMembers, privacy, memberIds, substituteId } = data;

  const members = [{
    userId,
    role: 'captain',
    joinedAt: new Date(),
    isSubstitute: false
  }];

  if (memberIds && Array.isArray(memberIds) && memberIds.length > 0) {
    const effectiveMax = maxMembers || 5;
    const totalMembers = memberIds.length + (substituteId ? 1 : 0) + 1;

    if (totalMembers > effectiveMax) {
      throw createError(
        'TOO_MANY_MEMBERS',
        `Cannot add ${memberIds.length} members. Max team size is ${effectiveMax} (including captain).`
      );
    }

    const allMemberIds = [...memberIds, ...(substituteId ? [substituteId] : [])];
    const users = await User.find({ _id: { $in: allMemberIds } });
    if (users.length !== allMemberIds.length) {
      throw createError('INVALID_MEMBERS', 'One or more selected users do not exist');
    }

    for (const memberId of memberIds) {
      if (memberId.toString() === userId.toString()) continue;
      members.push({
        userId: memberId,
        role: 'member',
        joinedAt: new Date(),
        isSubstitute: false
      });
    }

    if (substituteId && substituteId.toString() !== userId.toString()) {
      members.push({
        userId: substituteId,
        role: 'member',
        joinedAt: new Date(),
        isSubstitute: true
      });
    }
  }

  const team = new Team({
    name,
    tag,
    game,
    logo,
    description,
    captain: userId,
    members,
    maxMembers: maxMembers || 5,
    privacy: privacy || 'public'
  });

  await team.save();
  return populateTeamFull(team);
};

const getPublicTeams = async ({ game, search } = {}) => {
  const query = { isActive: true, privacy: 'public' };

  if (game) query.game = game;
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { tag: { $regex: search, $options: 'i' } }
    ];
  }

  return Team.find(query)
    .populate('captain', 'username avatarUrl')
    .populate('members.userId', 'username avatarUrl')
    .sort({ createdAt: -1 })
    .limit(50);
};

const getMyTeams = async (userId) => Team.find({
  'members.userId': userId,
  isActive: true
})
  .populate('captain', TEAM_POPULATE_FIELDS)
  .populate('members.userId', TEAM_POPULATE_FIELDS)
  .sort({ createdAt: -1 });

const getTeamById = async (id) => {
  const team = await Team.findById(id)
    .populate('captain', 'username avatarUrl level')
    .populate('members.userId', 'username avatarUrl level');

  if (!team) throw createError('TEAM_NOT_FOUND', 'Team not found', 404);
  return team;
};

const updateTeam = async (teamId, userId, data) => {
  const team = await Team.findById(teamId);
  if (!team) throw createError('TEAM_NOT_FOUND', 'Team not found', 404);
  if (!team.isCaptain(userId)) throw createError('NOT_CAPTAIN', 'Only team captain can update team', 403);

  const { name, game, memberIds, membersGameInfo, substituteId, captainGameInfo } = data;

  if (name) team.name = name;
  if (game) team.game = game;

  if (membersGameInfo && Array.isArray(membersGameInfo)) {
    await Promise.all(membersGameInfo.map((info) => applyGameInfoUpdate(info.userId, team.game, info)));
  }

  if (captainGameInfo) {
    const captainId = team.captain?._id || team.captain;
    await applyGameInfoUpdate(captainId, team.game, captainGameInfo);
  }

  if (memberIds && Array.isArray(memberIds)) {
    const captainId = team.captain.toString();
    const allMemberIds = [...memberIds, ...(substituteId ? [substituteId] : [])];
    const currentMemberIds = team.members.map(m => (m.userId?._id || m.userId).toString());
    const newMemberIds = [captainId, ...allMemberIds.filter(id => id !== captainId)];
    const addedIds = newMemberIds.filter(id => !currentMemberIds.includes(id));

    team.members = team.members.filter(m => {
      const mid = (m.userId?._id || m.userId).toString();
      return newMemberIds.includes(mid);
    });

    for (const addId of addedIds) {
      const isSubstitute = substituteId && addId === substituteId.toString();
      team.members.push({
        userId: addId,
        role: 'member',
        joinedAt: new Date(),
        isSubstitute
      });
    }

    team.members = team.members.map(m => {
      const mid = (m.userId?._id || m.userId).toString();
      const isSubstitute = substituteId && mid === substituteId.toString();
      return { ...m, isSubstitute };
    });

    team.maxMembers = Math.max(team.maxMembers, team.members.length);
  }

  await team.save();
  return populateTeamFull(team);
};

const deleteTeam = async (teamId, userId) => {
  const team = await Team.findById(teamId);
  if (!team) throw createError('TEAM_NOT_FOUND', 'Team not found', 404);
  if (!team.isCaptain(userId)) throw createError('NOT_CAPTAIN', 'Only team captain can delete team', 403);

  const activeRegistration = await TournamentRegistration.findOne({
    teamId: team._id,
    status: { $in: ['pending', 'images_uploaded', 'verified'] }
  }).populate('tournamentId', 'name status');

  if (activeRegistration) {
    const tournament = activeRegistration.tournamentId;
    const isOver = tournament && ['completed', 'cancelled', 'inactive'].includes(tournament.status);
    if (!isOver) {
      throw createError(
        'TEAM_IN_ACTIVE_TOURNAMENT',
        tournament
          ? `This team is registered in an active tournament "${tournament.name}". You can only delete the team after the tournament ends.`
          : 'This team is registered in an active tournament. You can only delete the team after the tournament ends.'
      );
    }
  }

  team.isActive = false;
  await team.save();
};

const leaveTeam = async (teamId, userId) => {
  const team = await Team.findById(teamId);
  if (!team) throw createError('TEAM_NOT_FOUND', 'Team not found', 404);
  if (team.isCaptain(userId)) {
    throw createError('CAPTAIN_CANNOT_LEAVE', 'Captain cannot leave team. Delete team or transfer captaincy first.');
  }

  team.removeMember(userId);
  await team.save();
};

const inviteUserToTeam = async (teamId, invitedBy, invitedUserId) => {
  if (!invitedUserId) throw createError('MISSING_USER_ID', 'User ID is required');

  const team = await Team.findById(teamId);
  if (!team) throw createError('TEAM_NOT_FOUND', 'Team not found', 404);
  if (!team.isCaptain(invitedBy)) throw createError('NOT_CAPTAIN', 'Only team captain can invite players', 403);
  if (team.members.length >= team.maxMembers) throw createError('TEAM_FULL', 'Team is full');
  if (team.isMember(invitedUserId)) throw createError('ALREADY_MEMBER', 'User is already a team member');

  const existingInvitation = await TeamInvitation.findOne({
    teamId: team._id,
    invitedUser: invitedUserId,
    status: 'pending'
  });
  if (existingInvitation) throw createError('INVITATION_EXISTS', 'Invitation already sent');

  const invitation = new TeamInvitation({
    teamId: team._id,
    invitedBy,
    invitedUser: invitedUserId
  });

  await invitation.save();
  await invitation.populate('teamId', 'name tag game logo');
  await invitation.populate('invitedBy', 'username avatarUrl');

  const invitingUserData = await User.findById(invitedBy).select('username');
  const notification = new Notification({
    user: invitedUserId,
    type: 'team_invitation',
    title: 'Team Invitation',
    message: `${invitingUserData.username} invited you to join ${team.name}`,
    actionUrl: '/teams?tab=teams',
    isRead: false,
    metadata: {
      teamId: team._id,
      teamName: team.name,
      invitedBy,
      invitationId: invitation._id
    }
  });
  await notification.save();

  return invitation;
};

const getMyInvitations = async (userId) => {
  const invitations = await TeamInvitation.find({
    invitedUser: userId,
    status: 'pending'
  })
    .populate('teamId', 'name tag game logo maxMembers')
    .populate('invitedBy', 'username avatarUrl')
    .sort({ createdAt: -1 });

  return invitations.filter(invitation => !invitation.isExpired());
};

const acceptInvitation = async (invitationId, userId) => {
  const invitation = await TeamInvitation.findById(invitationId).populate('teamId');
  if (!invitation) throw createError('INVITATION_NOT_FOUND', 'Invitation not found', 404);
  if (invitation.invitedUser.toString() !== userId) {
    throw createError('NOT_YOUR_INVITATION', 'This invitation is not for you', 403);
  }
  if (invitation.status !== 'pending') throw createError('INVITATION_NOT_PENDING', 'Invitation is no longer pending');
  if (invitation.isExpired()) {
    invitation.status = 'expired';
    await invitation.save();
    throw createError('INVITATION_EXPIRED', 'Invitation has expired');
  }

  const team = invitation.teamId;
  team.addMember(userId);
  await team.save();

  invitation.status = 'accepted';
  await invitation.save();

  return team;
};

const rejectInvitation = async (invitationId, userId) => {
  const invitation = await TeamInvitation.findById(invitationId);
  if (!invitation) throw createError('INVITATION_NOT_FOUND', 'Invitation not found', 404);
  if (invitation.invitedUser.toString() !== userId) {
    throw createError('NOT_YOUR_INVITATION', 'This invitation is not for you', 403);
  }

  invitation.status = 'rejected';
  await invitation.save();
};

const removeMember = async (teamId, captainId, memberId) => {
  if (!memberId) throw createError('MISSING_MEMBER_ID', 'Member ID is required');

  const team = await Team.findById(teamId);
  if (!team) throw createError('TEAM_NOT_FOUND', 'Team not found', 404);
  if (team.captain.toString() !== captainId) throw createError('NOT_CAPTAIN', 'Only team captain can remove members', 403);
  if (memberId === captainId) throw createError('CANNOT_REMOVE_CAPTAIN', 'Cannot remove team captain');

  team.removeMember(memberId);
  await team.save();
  await team.populate('captain', 'username avatarUrl');
  await team.populate('members.userId', 'username avatarUrl');

  return team;
};

const addMember = async (teamId, captainId, userId) => {
  if (!userId) throw createError('MISSING_USER_ID', 'User ID is required');

  const team = await Team.findById(teamId);
  if (!team) throw createError('TEAM_NOT_FOUND', 'Team not found', 404);
  if (team.captain.toString() !== captainId) throw createError('NOT_CAPTAIN', 'Only team captain can add members', 403);
  if (team.members.length >= team.maxMembers) throw createError('TEAM_FULL', 'Team is full');
  if (team.isMember(userId)) throw createError('ALREADY_MEMBER', 'User is already a team member');

  const userToAdd = await User.findById(userId);
  if (!userToAdd) throw createError('USER_NOT_FOUND', 'User not found', 404);

  team.addMember(userId);
  await team.save();
  await team.populate('captain', 'username avatarUrl');
  await team.populate('members.userId', 'username avatarUrl');

  return team;
};

module.exports = {
  acceptInvitation,
  addMember,
  createTeam,
  deleteTeam,
  getMyInvitations,
  getMyTeams,
  getPublicTeams,
  getTeamById,
  inviteUserToTeam,
  leaveTeam,
  rejectInvitation,
  removeMember,
  updateTeam
};
