import express from 'express'
import { verifyAdminToken } from '../../middleware/adminAuth.js'
import Prescription from '../../../models/Prescription.js'
import { body, validationResult } from 'express-validator'

const router = express.Router()

/**
 * GET /admin/prescriptions
 * Get all prescriptions (admin only)
 * Supports: pagination, status filter
 */
router.get('/', verifyAdminToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 50
    const skip = (page - 1) * limit

    const filter = { isActive: true }
    
    // Status filter
    if (req.query.status) {
      filter.status = req.query.status
    }

    const prescriptions = await Prescription.find(filter)
      .populate('user', 'name phone email')
      .populate('processedBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('-__v')

    const total = await Prescription.countDocuments(filter)

    res.json({
      success: true,
      prescriptions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Get all prescriptions error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch prescriptions'
    })
  }
})

/**
 * GET /admin/prescriptions/:id
 * Get single prescription (admin only)
 */
router.get('/:id', verifyAdminToken, async (req, res) => {
  try {
    const prescription = await Prescription.findById(req.params.id)
      .populate('user', 'name phone email')
      .populate('processedBy', 'name email')

    if (!prescription) {
      return res.status(404).json({
        success: false,
        message: 'Prescription not found'
      })
    }

    res.json({
      success: true,
      prescription
    })
  } catch (error) {
    console.error('Get prescription error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch prescription'
    })
  }
})

/**
 * PUT /admin/prescriptions/:id/status
 * Update prescription status (admin only)
 * Status: 'Pending', 'Verified', 'Completed'
 */
router.put('/:id/status', verifyAdminToken, [
  body('status').isIn(['Pending', 'Verified', 'Completed']).withMessage('Invalid status'),
  body('notes').optional().isString().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      })
    }

    const prescription = await Prescription.findById(req.params.id)

    if (!prescription) {
      return res.status(404).json({
        success: false,
        message: 'Prescription not found'
      })
    }

    const { status, notes } = req.body

    // Update status using the model method
    await prescription.updateStatus(
      req.admin._id,
      status,
      notes
    )

    // Fetch updated prescription with populated fields
    const updatedPrescription = await Prescription.findById(req.params.id)
      .populate('user', 'name phone email')
      .populate('processedBy', 'name email')

    res.json({
      success: true,
      message: 'Prescription status updated successfully',
      prescription: updatedPrescription
    })
  } catch (error) {
    console.error('Update prescription status error:', error)
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update prescription status'
    })
  }
})

/**
 * DELETE /admin/prescriptions/:id
 * Delete prescription (admin only - hard delete)
 */
router.delete('/:id', verifyAdminToken, async (req, res) => {
  try {
    const prescription = await Prescription.findById(req.params.id)

    if (!prescription) {
      return res.status(404).json({
        success: false,
        message: 'Prescription not found'
      })
    }

    prescription.isActive = false
    await prescription.save()

    res.json({
      success: true,
      message: 'Prescription deleted successfully'
    })
  } catch (error) {
    console.error('Delete prescription error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to delete prescription'
    })
  }
})

export default router








