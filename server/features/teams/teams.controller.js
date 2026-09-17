const teamsService = require('./teams.service');

const errorResponse = (res, status, code, message) => res.status(status).json({
  success: false,
  error: {
    code,
    message,
    timestamp: new Date().toISOString()
  }
});

const handleKnownError = (res, error, fallbackMessage) => {
  if (error.code && error.status) {
    return errorResponse(res, error.status, error.code, error.message);
  }

  return errorResponse(res, 500, 'SERVER_ERROR', error.message || fallbackMessage);
};

const createTeam = async (req, res) => {
  try {
    const team = await teamsService.createTeam(req.user.userId, req.body);
    res.status(201).json({
      success: true,
      data: { team },
      message: 'Team created successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error creating team:', error);
    handleKnownError(res, error, 'Failed to create team');
  }
};

const getPublicTeams = async (req, res) => {
  try {
    const teams = await teamsService.getPublicTeams(req.query);
    res.json({
      success: true,
      data: { teams },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching teams:', error);
    errorResponse(res, 500, 'SERVER_ERROR', 'Failed to fetch teams');
  }
};

const getMyTeams = async (req, res) => {
  try {
    const teams = await teamsService.getMyTeams(req.user.userId);
    res.json({
      success: true,
      data: { teams },
      cached: false,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching user teams:', error);
    errorResponse(res, 500, 'SERVER_ERROR', 'Failed to fetch teams');
  }
};

const getTeamById = async (req, res) => {
  try {
    const team = await teamsService.getTeamById(req.params.id);
    res.json({
      success: true,
      data: { team },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching team:', error);
    handleKnownError(res, error, 'Failed to fetch team');
  }
};

const updateTeam = async (req, res) => {
  try {
    const team = await teamsService.updateTeam(req.params.id, req.user.userId, req.body);
    res.json({
      success: true,
      data: { team },
      message: 'Team updated successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error updating team:', error);
    handleKnownError(res, error, 'Failed to update team');
  }
};

const deleteTeam = async (req, res) => {
  try {
    await teamsService.deleteTeam(req.params.id, req.user.userId);
    res.json({
      success: true,
      message: 'Team deleted successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error deleting team:', error);
    handleKnownError(res, error, 'Failed to delete team');
  }
};

const leaveTeam = async (req, res) => {
  try {
    await teamsService.leaveTeam(req.params.id, req.user.userId);
    res.json({
      success: true,
      message: 'Left team successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error leaving team:', error);
    handleKnownError(res, error, 'Failed to leave team');
  }
};

const inviteUserToTeam = async (req, res) => {
  try {
    const invitation = await teamsService.inviteUserToTeam(req.params.id, req.user.userId, req.body.userId);
    res.status(201).json({
      success: true,
      data: { invitation },
      message: 'Invitation sent successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error sending invitation:', error);
    handleKnownError(res, error, 'Failed to send invitation');
  }
};

const getMyInvitations = async (req, res) => {
  try {
    const invitations = await teamsService.getMyInvitations(req.user.userId);
    res.json({
      success: true,
      data: { invitations },
      cached: false,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching invitations:', error);
    errorResponse(res, 500, 'SERVER_ERROR', 'Failed to fetch invitations');
  }
};

const acceptInvitation = async (req, res) => {
  try {
    const team = await teamsService.acceptInvitation(req.params.id, req.user.userId);
    res.json({
      success: true,
      message: 'Joined team successfully',
      data: { team },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error accepting invitation:', error);
    handleKnownError(res, error, 'Failed to accept invitation');
  }
};

const rejectInvitation = async (req, res) => {
  try {
    await teamsService.rejectInvitation(req.params.id, req.user.userId);
    res.json({
      success: true,
      message: 'Invitation rejected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error rejecting invitation:', error);
    handleKnownError(res, error, 'Failed to reject invitation');
  }
};

const removeMember = async (req, res) => {
  try {
    const team = await teamsService.removeMember(req.params.id, req.user.userId, req.body.memberId);
    res.json({
      success: true,
      message: 'Member removed successfully',
      data: { team },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error removing member:', error);
    handleKnownError(res, error, 'Failed to remove member');
  }
};

const addMember = async (req, res) => {
  try {
    const team = await teamsService.addMember(req.params.id, req.user.userId, req.body.userId);
    res.json({
      success: true,
      message: 'Member added successfully',
      data: { team },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error adding member:', error);
    handleKnownError(res, error, 'Failed to add member');
  }
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
