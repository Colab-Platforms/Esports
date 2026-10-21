const express = require('express');
const teamsController = require('./teams.controller');
const { teamsAuth } = require('./teams.permissions');

const router = express.Router();

// Teams
router.post('/', teamsAuth, teamsController.createTeam);
router.get('/', teamsController.getPublicTeams);
router.get('/my-teams', teamsAuth, teamsController.getMyTeams);
router.get('/:id', teamsController.getTeamById);
router.put('/:id', teamsAuth, teamsController.updateTeam);
router.delete('/:id', teamsAuth, teamsController.deleteTeam);
router.post('/:id/leave', teamsAuth, teamsController.leaveTeam);

// Invitations
router.post('/:id/invite', teamsAuth, teamsController.inviteUserToTeam);
router.get('/invitations/my-invitations', teamsAuth, teamsController.getMyInvitations);
router.post('/invitations/:id/accept', teamsAuth, teamsController.acceptInvitation);
router.post('/invitations/:id/reject', teamsAuth, teamsController.rejectInvitation);

// Member management
router.post('/:id/remove-member', teamsAuth, teamsController.removeMember);
router.post('/:id/add-member', teamsAuth, teamsController.addMember);

module.exports = router;
