const mongoose = require('mongoose');
const Registration = require('../../models/TournamentRegistration');
const Tournament = require('../../models/Tournament');

// Legacy game-specific endpoints must not bypass Valorant claims/counters.
// No change to the existing BGMI/Free Fire registration lifecycle.
module.exports = router => {
  const guard = tournamentId => Tournament.exists({ _id: tournamentId, gameType: 'valorant' });
  router.param('registrationId', async (req, res, next, id) => {
    try {
      if (mongoose.isValidObjectId(id)) {
        const row = await Registration.findById(id).select('tournamentId').lean();
        if (row && await guard(row.tournamentId)) return res.status(409).json({ success: false, error: { code: 'USE_VALORANT_REGISTRATION_API' } });
      }
      next();
    } catch (error) { next(error); }
  });
  router.param('tournamentId', async (req, res, next, id) => {
    try {
      if (mongoose.isValidObjectId(id) && await guard(id)) return res.status(409).json({ success: false, error: { code: 'USE_VALORANT_REGISTRATION_API' } });
      next();
    } catch (error) { next(error); }
  });
};
