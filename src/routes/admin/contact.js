import express from 'express'
import { body, validationResult } from 'express-validator'
import { verifyAdminToken } from '../../middleware/adminAuth.js'
import ContactMessage, { CONTACT_STATUSES } from '../../../models/ContactMessage.js'

const router = express.Router()

router.get('/', verifyAdminToken, async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1)
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100)
    const skip = (page - 1) * limit

    const filter = {}

    if (req.query.status && req.query.status !== 'all') {
      const status = req.query.status.toLowerCase()
      if (CONTACT_STATUSES.includes(status)) {
        filter.status = status
      }
    }

    if (req.query.search) {
      filter.$or = [
        { name: { $regex: req.query.search, $options: 'i' } },
        { email: { $regex: req.query.search, $options: 'i' } },
        { phone: { $regex: req.query.search, $options: 'i' } }
      ]
    }

    const [messages, total] = await Promise.all([
      ContactMessage.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      ContactMessage.countDocuments(filter)
    ])

    res.json({
      success: true,
      data: messages,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Fetch contact messages error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch contact requests'
    })
  }
})

router.get('/:id', verifyAdminToken, async (req, res) => {
  try {
    const contactMessage = await ContactMessage.findById(req.params.id)

    if (!contactMessage) {
      return res.status(404).json({
        success: false,
        message: 'Contact request not found'
      })
    }

    res.json({
      success: true,
      data: contactMessage
    })
  } catch (error) {
    console.error('Get contact message error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch contact request'
    })
  }
})

router.patch('/:id', verifyAdminToken, [
  body('status').optional().isIn(CONTACT_STATUSES).withMessage('Invalid status'),
  body('resolutionNotes').optional().isString().isLength({ max: 2000 }),
  body('adminReply').optional().isString().isLength({ min: 10, max: 2000 }).withMessage('Reply must be between 10 and 2000 characters'),
  body('priority').optional().isIn(['low', 'medium', 'high'])
], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(422).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      })
    }

    const contactMessage = await ContactMessage.findById(req.params.id)

    if (!contactMessage) {
      return res.status(404).json({
        success: false,
        message: 'Contact request not found'
      })
    }

    if (req.body.status) {
      contactMessage.status = req.body.status
      contactMessage.assignedTo = req.admin?._id
      if (req.body.status === 'resolved' || req.body.status === 'closed') {
        contactMessage.respondedAt = new Date()
      }
    }

    if (req.body.resolutionNotes !== undefined) {
      contactMessage.resolutionNotes = req.body.resolutionNotes
    }

    if (req.body.adminReply !== undefined) {
      contactMessage.adminReply = req.body.adminReply
      contactMessage.repliedBy = req.admin?._id
      contactMessage.repliedAt = new Date()
      contactMessage.status = req.body.status || 'in_progress'
      contactMessage.assignedTo = req.admin?._id
      
      // Notify user about the reply
      try {
        const { notifyContactReply } = await import('../../services/notificationService.js')
        const adminName = req.admin?.name || 'HealthPlus Team'
        const notifications = await notifyContactReply(contactMessage, adminName)
        console.log('📧 Notifications sent:', notifications)
      } catch (notifError) {
        console.error('⚠️ Failed to send notifications:', notifError.message)
        // Don't fail the request if notification fails
      }
    }

    if (req.body.priority) {
      contactMessage.priority = req.body.priority
    }

    await contactMessage.save()

    res.json({
      success: true,
      message: 'Contact request updated successfully',
      data: contactMessage
    })
  } catch (error) {
    console.error('Update contact message error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to update contact request'
    })
  }
})

export default router












