const express = require('express');
const Tournament = require('../../models/Tournament');
const router = express.Router();

// Reads the same public scoreboard collection as the legacy BGMI/Free Fire
// galleries. Publishing final standings is deliberately not a prerequisite.
router.get('/tournaments/scoreboards-gallery', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const { gameType } = req.query;
  const page = Number(req.query.page || 1), limit = Number(req.query.limit || 12);
  if (!['bgmi', 'freefire', 'valorant'].includes(gameType) ||
    !Number.isInteger(page) || page < 1 || page > 100000 || !Number.isInteger(limit) || limit < 1 || limit > 100) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_QUERY', message: 'Select a supported game and valid page size.' } });
  }
  try {
    const [result] = await Tournament.aggregate([
      { $match: { gameType, 'scoreboards.0': { $exists: true } } },
      { $unwind: '$scoreboards' },
      { $match: { 'scoreboards.imageUrl': { $type: 'string', $ne: '' } } },
      { $sort: { 'scoreboards.uploadedAt': -1, 'scoreboards._id': -1, _id: -1 } },
      { $facet: {
        rows: [{ $skip: (page - 1) * limit }, { $limit: limit }, { $project: {
          _id: '$scoreboards._id', imageUrl: '$scoreboards.imageUrl', description: '$scoreboards.description', uploadedAt: '$scoreboards.uploadedAt',
          tournament: { id: '$_id', name: '$name', gameType: '$gameType', status: '$status', endDate: '$endDate' }
        } }],
        count: [{ $count: 'total' }]
      } }
    ]);
    const total = result?.count[0]?.total || 0;
    res.json({ success: true, data: { scoreboards: result?.rows || [], pagination: { page, limit, total, hasMore: page * limit < total } } });
  } catch (_error) {
    res.status(503).json({ success: false, error: { code: 'SCOREBOARDS_UNAVAILABLE', message: 'Scoreboards are temporarily unavailable. Please try again.' } });
  }
});
module.exports = router;
