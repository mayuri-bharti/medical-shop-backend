import express from 'express'
import { body, query, param, validationResult } from 'express-validator'
import { verifyAdminToken } from '../../middleware/adminAuth.js'
import Appointment from '../../../models/Appointment.js'

const router = express.Router()

const allowedStatuses = ['pending', 'confirmed', 'completed', 'cancelled']

router.get(
  '/',
  verifyAdminToken,
  [
    query('status').optional().isIn([...allowedStatuses, 'all']),
    query('doctor').optional().isMongoId()
  ],
  async (req, res) => {
    try {
      const filter = {}
      if (req.query.status && req.query.status !== 'all') {
        filter.status = req.query.status
      }
      if (req.query.doctor) {
        filter.doctor = req.query.doctor
      }

      const appointments = await Appointment.find(filter)
        .populate('doctor', 'name specialty')
        .populate('user', 'name phone email')
        .sort({ date: -1, createdAt: -1 })
        .limit(100)

      res.json({ success: true, data: appointments })
    } catch (error) {
      console.error('Admin fetch appointments error:', error)
      res.status(500).json({ success: false, message: 'Failed to fetch appointments' })
    }
  }
)

router.patch(
  '/:id/status',
  verifyAdminToken,
  [
    param('id').isMongoId(),
    body('status').isIn(allowedStatuses),
    body('note').optional().isString()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() })
      }

      const appointment = await Appointment.findById(req.params.id)
      if (!appointment) {
        return res.status(404).json({ success: false, message: 'Appointment not found' })
      }

      appointment.status = req.body.status
      appointment.notes = req.body.note || appointment.notes
      appointment.createdBy = 'admin'
      await appointment.save()

      const populated = await appointment.populate([
        { path: 'doctor', select: 'name specialty' },
        { path: 'user', select: 'name phone email' }
      ])

      res.json({
        success: true,
        message: 'Appointment status updated',
        data: populated
      })
    } catch (error) {
      console.error('Admin update appointment error:', error)
      res.status(500).json({ success: false, message: 'Failed to update appointment' })
    }
  }
)

export default router

