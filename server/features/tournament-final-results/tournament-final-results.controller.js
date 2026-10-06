const service = require('./tournament-final-results.service');

const sendError = (res, error, fallbackCode) => res.status(error.status || 500).json({
  success: false,
  error: {
    code: error.code || fallbackCode,
    message: error.message || 'Request failed',
    timestamp: new Date().toISOString()
  }
});

const actorId = (req) => req.user?.userId || req.user?.id;

const getPublicFinalResult = async (req, res) => {
  try {
    const finalResult = await service.getPublicFinalResult({ tournamentId: req.params.tournamentId });
    res.json({ success: true, data: { finalResult }, timestamp: new Date().toISOString() });
  } catch (error) {
    sendError(res, error, 'FETCH_TOURNAMENT_FINAL_RESULT_FAILED');
  }
};

const getAdminFinalResult = async (req, res) => {
  try {
    const finalResult = await service.getAdminFinalResult({ tournamentId: req.params.tournamentId });
    res.json({ success: true, data: { finalResult }, timestamp: new Date().toISOString() });
  } catch (error) {
    sendError(res, error, 'FETCH_ADMIN_TOURNAMENT_FINAL_RESULT_FAILED');
  }
};

const previewFinalResult = async (req, res) => {
  try {
    const preview = await service.derivePreview({
      tournamentId: req.params.tournamentId,
      explicitStandings: req.body?.standings || req.query?.standings
    });
    res.json({ success: true, data: { preview }, timestamp: new Date().toISOString() });
  } catch (error) {
    sendError(res, error, 'PREVIEW_TOURNAMENT_FINAL_RESULT_FAILED');
  }
};

const publishFinalResult = async (req, res) => {
  try {
    const finalResult = await service.publishFinalResult({
      tournamentId: req.params.tournamentId,
      payload: req.body,
      actorId: actorId(req)
    });
    res.json({ success: true, data: { finalResult }, timestamp: new Date().toISOString() });
  } catch (error) {
    sendError(res, error, 'PUBLISH_TOURNAMENT_FINAL_RESULT_FAILED');
  }
};

const voidFinalResult = async (req, res) => {
  try {
    const finalResult = await service.voidFinalResult({
      tournamentId: req.params.tournamentId,
      actorId: actorId(req)
    });
    res.json({ success: true, data: { finalResult }, timestamp: new Date().toISOString() });
  } catch (error) {
    sendError(res, error, 'VOID_TOURNAMENT_FINAL_RESULT_FAILED');
  }
};

module.exports = {
  getAdminFinalResult,
  getPublicFinalResult,
  previewFinalResult,
  publishFinalResult,
  voidFinalResult
};
