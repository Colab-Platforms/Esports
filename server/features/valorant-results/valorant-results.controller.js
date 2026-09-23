const service = require('./valorant-results.service');

const sendError = (res, error, fallbackCode) => res.status(error.status || 500).json({
  success: false,
  error: {
    code: error.code || fallbackCode,
    message: error.message || 'Request failed',
    timestamp: new Date().toISOString()
  }
});

const isResultManager = (req) => req.user && ['admin', 'moderator'].includes(req.user.role);

const createResult = async (req, res) => {
  try {
    const result = await service.createValorantResult({ payload: req.body, actorId: req.user.userId });
    res.status(201).json({ success: true, data: { result: service.normalizeAdminValorantResult(result) }, timestamp: new Date().toISOString() });
  } catch (error) {
    sendError(res, error, 'CREATE_VALORANT_RESULT_FAILED');
  }
};

const getTournamentResults = async (req, res) => {
  try {
    const results = await service.getValorantTournamentResults({ tournamentId: req.params.tournamentId, admin: isResultManager(req) && req.query.admin === 'true' });
    res.json({ success: true, data: { results }, timestamp: new Date().toISOString() });
  } catch (error) {
    sendError(res, error, 'FETCH_VALORANT_RESULTS_FAILED');
  }
};

const getResultById = async (req, res) => {
  try {
    const result = await service.getValorantResultById({ resultId: req.params.id, admin: isResultManager(req) && req.query.admin === 'true' });
    res.json({ success: true, data: { result }, timestamp: new Date().toISOString() });
  } catch (error) {
    sendError(res, error, 'FETCH_VALORANT_RESULT_FAILED');
  }
};

const updateResult = async (req, res) => {
  try {
    const result = await service.updateValorantResult({ resultId: req.params.id, payload: req.body, actorId: req.user.userId });
    res.json({ success: true, data: { result: service.normalizeAdminValorantResult(result) }, timestamp: new Date().toISOString() });
  } catch (error) {
    sendError(res, error, 'UPDATE_VALORANT_RESULT_FAILED');
  }
};

const verifyResult = async (req, res) => {
  try {
    const result = await service.verifyValorantResult({ resultId: req.params.id, actorId: req.user.userId });
    res.json({ success: true, data: { result: service.normalizeAdminValorantResult(result) }, timestamp: new Date().toISOString() });
  } catch (error) {
    sendError(res, error, 'VERIFY_VALORANT_RESULT_FAILED');
  }
};

const voidResult = async (req, res) => {
  try {
    const result = await service.voidValorantResult({ resultId: req.params.id, actorId: req.user.userId });
    res.json({ success: true, data: { result: service.normalizeAdminValorantResult(result) }, timestamp: new Date().toISOString() });
  } catch (error) {
    sendError(res, error, 'VOID_VALORANT_RESULT_FAILED');
  }
};

module.exports = { createResult, getResultById, getTournamentResults, updateResult, verifyResult, voidResult };
