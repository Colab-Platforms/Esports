const multer = require('multer');
const service = require('./result-ingestion.service');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }
});

const actorId = (req) => req.user?.userId || req.user?.id || req.user?._id;

const sendError = (res, error, fallback = 'Result ingestion request failed') => {
  console.error('Result ingestion error:', error);
  return res.status(error.status || 500).json({
    success: false,
    error: {
      code: error.code || 'RESULT_INGESTION_ERROR',
      message: error.message || fallback,
      timestamp: new Date().toISOString()
    }
  });
};

const createFreeFireScoreboardJob = async (req, res) => {
  try {
    const result = await service.createFreeFireScoreboardJob({
      file: req.file,
      payload: req.body,
      actorId: actorId(req)
    });
    return res.status(result.duplicate ? 200 : 201).json({
      success: true,
      data: result
    });
  } catch (error) {
    return sendError(res, error, 'Failed to create scoreboard ingestion job');
  }
};

const getJob = async (req, res) => {
  try {
    const job = await service.getJob({ jobId: req.params.jobId });
    return res.json({ success: true, data: { job } });
  } catch (error) {
    return sendError(res, error, 'Failed to load scoreboard ingestion job');
  }
};

const patchReview = async (req, res) => {
  try {
    const job = await service.patchReview({
      jobId: req.params.jobId,
      payload: req.body,
      actorId: actorId(req)
    });
    return res.json({ success: true, data: { job } });
  } catch (error) {
    return sendError(res, error, 'Failed to update scoreboard ingestion review');
  }
};

const confirm = async (req, res) => {
  try {
    const result = await service.confirm({
      jobId: req.params.jobId,
      actorId: actorId(req)
    });
    return res.json({ success: true, data: result });
  } catch (error) {
    return sendError(res, error, 'Failed to confirm scoreboard ingestion job');
  }
};

const reprocess = async (req, res) => {
  try {
    const job = await service.reprocessJob({
      jobId: req.params.jobId,
      actorId: actorId(req)
    });
    return res.json({ success: true, data: { job } });
  } catch (error) {
    return sendError(res, error, 'Failed to reprocess scoreboard ingestion job');
  }
};

const cancel = async (req, res) => {
  try {
    const job = await service.cancel({
      jobId: req.params.jobId,
      actorId: actorId(req)
    });
    return res.json({ success: true, data: { job } });
  } catch (error) {
    return sendError(res, error, 'Failed to cancel scoreboard ingestion job');
  }
};

module.exports = {
  cancel,
  confirm,
  createFreeFireScoreboardJob,
  getJob,
  patchReview,
  reprocess,
  upload
};
