const mongoose = require('mongoose');
const ExploreContent = require('./explore.model');
const { CONTENT_TYPES, PUBLIC_FIELDS } = require('./explore.constants');

const isValidContentType = (contentType) => CONTENT_TYPES.includes(contentType);

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const parsePagination = ({ page = 1, limit = 12 }, maxLimit) => {
  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || 12, 1), maxLimit);
  return { pageNum, limitNum };
};

const getPublicExploreContent = async ({ contentType, page, limit }) => {
  const { pageNum, limitNum } = parsePagination({ page, limit }, 50);

  const baseQuery = { isActive: true };
  if (contentType && isValidContentType(contentType)) {
    baseQuery.contentType = contentType;
  }

  const featuredPromise = pageNum === 1
    ? ExploreContent.find({ ...baseQuery, isFeatured: true })
        .sort({ displayOrder: 1, createdAt: -1 })
        .select(PUBLIC_FIELDS)
        .lean()
    : Promise.resolve([]);

  const itemsQuery = { ...baseQuery, isFeatured: { $ne: true } };

  const [featured, items, total] = await Promise.all([
    featuredPromise,
    ExploreContent.find(itemsQuery)
      .sort({ displayOrder: 1, createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .select(PUBLIC_FIELDS)
      .lean(),
    ExploreContent.countDocuments(itemsQuery)
  ]);

  return {
    featured,
    items,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      hasMore: pageNum * limitNum < total
    }
  };
};

const trackExploreClick = async (id) => {
  if (!isValidObjectId(id)) return null;

  return ExploreContent.findByIdAndUpdate(
    id,
    { $inc: { clickCount: 1 } },
    { new: false }
  ).select('_id');
};

const getAdminExploreContent = async ({ contentType, page, limit }) => {
  const { pageNum, limitNum } = parsePagination({ page, limit: limit || 50 }, 200);

  const query = {};
  if (contentType && isValidContentType(contentType)) {
    query.contentType = contentType;
  }

  const [items, total] = await Promise.all([
    ExploreContent.find(query)
      .sort({ displayOrder: 1, createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .populate('createdBy', 'username')
      .populate('updatedBy', 'username')
      .lean(),
    ExploreContent.countDocuments(query)
  ]);

  return {
    items,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      hasMore: pageNum * limitNum < total
    }
  };
};

const getExploreContentById = async (id) => {
  if (!isValidObjectId(id)) return null;

  return ExploreContent.findById(id)
    .populate('createdBy', 'username')
    .populate('updatedBy', 'username')
    .lean();
};

const createExploreContent = async (data, userId) => {
  const {
    title, description, url, thumbnailUrl,
    contentType, platform, isFeatured, isActive, displayOrder
  } = data;

  const item = new ExploreContent({
    title,
    description,
    url,
    thumbnailUrl,
    contentType,
    platform,
    isFeatured,
    isActive,
    displayOrder,
    createdBy: userId
  });

  await item.save();
  return item;
};

const updateExploreContent = async (id, data, userId) => {
  if (!isValidObjectId(id)) return null;

  const {
    title, description, url, thumbnailUrl,
    contentType, platform, isFeatured, isActive, displayOrder
  } = data;

  const updateData = {
    ...(title !== undefined && { title }),
    ...(description !== undefined && { description }),
    ...(url !== undefined && { url }),
    ...(thumbnailUrl !== undefined && { thumbnailUrl }),
    ...(contentType !== undefined && { contentType }),
    ...(platform !== undefined && { platform }),
    ...(isFeatured !== undefined && { isFeatured }),
    ...(isActive !== undefined && { isActive }),
    ...(displayOrder !== undefined && { displayOrder }),
    updatedBy: userId
  };

  return ExploreContent.findByIdAndUpdate(
    id,
    updateData,
    { new: true, runValidators: true }
  );
};

const toggleExploreContentActive = async (id, userId) => {
  if (!isValidObjectId(id)) return null;

  const existing = await ExploreContent.findById(id).select('isActive');
  if (!existing) return null;

  return ExploreContent.findByIdAndUpdate(
    id,
    { isActive: !existing.isActive, updatedBy: userId },
    { new: true }
  );
};

const reorderExploreContent = async (items, userId) => {
  if (!Array.isArray(items) || items.length === 0) {
    return { matched: false, reason: 'empty' };
  }

  const validItems = items.filter(
    (entry) => entry && isValidObjectId(entry.id) && typeof entry.displayOrder === 'number'
  );

  if (validItems.length === 0) {
    return { matched: false, reason: 'invalid' };
  }

  await ExploreContent.bulkWrite(
    validItems.map(({ id, displayOrder }) => ({
      updateOne: {
        filter: { _id: id },
        update: { displayOrder, updatedBy: userId }
      }
    }))
  );

  return { matched: true };
};

const deleteExploreContent = async (id) => {
  if (!isValidObjectId(id)) return null;
  return ExploreContent.findByIdAndDelete(id);
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
