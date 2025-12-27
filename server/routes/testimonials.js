const express = require('express');
const Testimonial = require('../models/Testimonial');
const auth = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/testimonials
// @desc    Get all active testimonials
// @access  Public
router.get('/', async (req, res) => {
  try {
    const { gameType, limit } = req.query;
    
    const query = { isActive: true };
    if (gameType) query.gameType = gameType;
    
    const testimonials = await Testimonial.find(query)
      .sort({ displayOrder: 1, createdAt: -1 })
      .limit(limit ? parseInt(limit) : 0)
      .populate('createdBy', 'username')
      .select('-__v');
    
    res.json({
      success: true,
      data: testimonials,
      count: testimonials.length
    });
  } catch (error) {
    console.error('❌ Get testimonials error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch testimonials',
        details: error.message
      }
    });
  }
});

// @route   GET /api/testimonials/:id
// @desc    Get single testimonial
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const testimonial = await Testimonial.findById(req.params.id)
      .populate('createdBy', 'username')
      .select('-__v');
    
    if (!testimonial) {
      return res.status(404).json({
        success: false,
        error: { message: 'Testimonial not found' }
      });
    }
    
    res.json({
      success: true,
      data: testimonial
    });
  } catch (error) {
    console.error('❌ Get testimonial error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch testimonial',
        details: error.message
      }
    });
  }
});

// @route   POST /api/testimonials
// @desc    Create new testimonial (Admin only)
// @access  Private (Admin)
router.post('/', auth, async (req, res) => {
  try {
    // Check admin permissions
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: { message: 'Admin access required' }
      });
    }
    
    const testimonialData = {
      ...req.body,
      createdBy: req.user.id
    };
    
    const testimonial = new Testimonial(testimonialData);
    await testimonial.save();
    
    res.status(201).json({
      success: true,
      data: testimonial,
      message: 'Testimonial created successfully'
    });
  } catch (error) {
    console.error('❌ Create testimonial error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to create testimonial',
        details: error.message
      }
    });
  }
});

// @route   PUT /api/testimonials/:id
// @desc    Update testimonial (Admin only)
// @access  Private (Admin)
router.put('/:id', auth, async (req, res) => {
  try {
    // Check admin permissions
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: { message: 'Admin access required' }
      });
    }
    
    const testimonial = await Testimonial.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!testimonial) {
      return res.status(404).json({
        success: false,
        error: { message: 'Testimonial not found' }
      });
    }
    
    res.json({
      success: true,
      data: testimonial,
      message: 'Testimonial updated successfully'
    });
  } catch (error) {
    console.error('❌ Update testimonial error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to update testimonial',
        details: error.message
      }
    });
  }
});

// @route   DELETE /api/testimonials/:id
// @desc    Delete testimonial (Admin only)
// @access  Private (Admin)
router.delete('/:id', auth, async (req, res) => {
  try {
    // Check admin permissions
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: { message: 'Admin access required' }
      });
    }
    
    const testimonial = await Testimonial.findByIdAndDelete(req.params.id);
    
    if (!testimonial) {
      return res.status(404).json({
        success: false,
        error: { message: 'Testimonial not found' }
      });
    }
    
    res.json({
      success: true,
      message: 'Testimonial deleted successfully'
    });
  } catch (error) {
    console.error('❌ Delete testimonial error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to delete testimonial',
        details: error.message
      }
    });
  }
});

module.exports = router;