const exploreService = require('./explore.service');

const errorResponse = (res, status, code, message) => res.status(status).json({
  success: false,
  error: {
    code,
    message,
    timestamp: new Date().toISOString()
  }
});

const notFound = (res) => errorResponse(res, 404, 'CONTENT_NOT_FOUND', 'Content not found');

const validationError = (res, error) => errorResponse(
  res,
  400,
  'VALIDATION_ERROR',
  Object.values(error.errors)[0]?.message || 'Invalid content data'
);

const getPublicExploreContent = async (req, res) => {
  try {
    const data = await exploreService.getPublicExploreContent(req.query);

    res.json({
      success: true,
      data,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching explore content:', error);
    errorResponse(res, 500, 'SERVER_ERROR', 'Failed to fetch explore content');
  }
};

const trackExploreClick = async (req, res) => {
  try {
    const updated = await exploreService.trackExploreClick(req.params.id);
    if (!updated) return notFound(res);

    res.json({
      success: true,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error tracking explore click:', error);
    errorResponse(res, 500, 'SERVER_ERROR', 'Failed to track click');
  }
};

const getAdminExploreContent = async (req, res) => {
  try {
    const data = await exploreService.getAdminExploreContent(req.query);

    res.json({
      success: true,
      data,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching admin explore content:', error);
    errorResponse(res, 500, 'SERVER_ERROR', 'Failed to fetch explore content');
  }
};

const getExploreContentById = async (req, res) => {
  try {
    const item = await exploreService.getExploreContentById(req.params.id);
    if (!item) return notFound(res);

    res.json({
      success: true,
      data: { item },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching explore content item:', error);
    errorResponse(res, 500, 'SERVER_ERROR', 'Failed to fetch content');
  }
};

const createExploreContent = async (req, res) => {
  try {
    const { title, url, thumbnailUrl, contentType } = req.body;

    if (!title || !url || !thumbnailUrl || !contentType) {
      return errorResponse(
        res,
        400,
        'MISSING_REQUIRED_FIELDS',
        'title, url, thumbnailUrl, and contentType are required'
      );
    }

    const item = await exploreService.createExploreContent(req.body, req.user.userId);

    res.status(201).json({
      success: true,
      data: { item },
      message: 'Content created successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return validationError(res, error);
    }

    console.error('Error creating explore content:', error);
    errorResponse(res, 500, 'SERVER_ERROR', 'Failed to create content');
  }
};

const updateExploreContent = async (req, res) => {
  try {
    const item = await exploreService.updateExploreContent(req.params.id, req.body, req.user.userId);
    if (!item) return notFound(res);

    res.json({
      success: true,
      data: { item },
      message: 'Content updated successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return validationError(res, error);
    }

    console.error('Error updating explore content:', error);
    errorResponse(res, 500, 'SERVER_ERROR', 'Failed to update content');
  }
};

const toggleExploreContentActive = async (req, res) => {
  try {
    const item = await exploreService.toggleExploreContentActive(req.params.id, req.user.userId);
    if (!item) return notFound(res);

    res.json({
      success: true,
      data: { item },
      message: 'Content status updated',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error toggling explore content status:', error);
    errorResponse(res, 500, 'SERVER_ERROR', 'Failed to update content status');
  }
};

const reorderExploreContent = async (req, res) => {
  try {
    const result = await exploreService.reorderExploreContent(req.body.items, req.user.userId);

    if (!result.matched) {
      return errorResponse(
        res,
        400,
        'INVALID_REORDER_DATA',
        result.reason === 'empty'
          ? 'items must be a non-empty array of { id, displayOrder }'
          : 'No valid { id, displayOrder } entries provided'
      );
    }

    res.json({
      success: true,
      message: 'Content order updated',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error reordering explore content:', error);
    errorResponse(res, 500, 'SERVER_ERROR', 'Failed to reorder content');
  }
};

const deleteExploreContent = async (req, res) => {
  try {
    const item = await exploreService.deleteExploreContent(req.params.id);
    if (!item) return notFound(res);

    res.json({
      success: true,
      message: 'Content deleted successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error deleting explore content:', error);
    errorResponse(res, 500, 'SERVER_ERROR', 'Failed to delete content');
  }
};

module.exports = {
  createExploreContent,
  deleteExploreContent,
  getAdminExploreContent,
  getExploreContentById,
  getPublicExploreContent,
  reorderExploreContent,
  toggleExploreContentActive,
  trackExploreClick,
  updateExploreContent
};
