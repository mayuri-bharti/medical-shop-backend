import express from 'express'
import { body, validationResult } from 'express-validator'
import ContactMessage from '../models/ContactMessage.js'
import jwt from 'jsonwebtoken'

const router = express.Router()

const attemptGetUserId = (req) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '')
    if (!token) return null
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    return decoded?.userId || null
  } catch (error) {
    return null
  }
}

router.post('/', [
  body('name').trim().isLength({ min: 2 }).withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('phone').optional().isLength({ min: 8 }).withMessage('Phone must be at least 8 characters'),
  body('message').trim().isLength({ min: 10 }).withMessage('Message must be at least 10 characters'),
  body('source').optional().isString().isLength({ max: 50 }),
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

    const { name, email, phone, message, source = 'contact_page', priority = 'medium' } = req.body

    const userId = attemptGetUserId(req)

    const contactMessage = await ContactMessage.create({
      name,
      email,
      phone,
      message,
      source,
      priority,
      user: userId || undefined,
      metadata: {
        ip: req.headers['x-forwarded-for']?.split(',')[0] || req.ip,
        userAgent: req.headers['user-agent']
      }
    })

    res.status(201).json({
      success: true,
      message: 'Thanks for contacting us. Our care concierge will reach out shortly.',
      data: contactMessage
    })
  } catch (error) {
    console.error('Create contact message error:', error)
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to submit contact request'
    })
  }
})

export default router



