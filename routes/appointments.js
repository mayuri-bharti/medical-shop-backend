import express from 'express'
import { body, param, validationResult } from 'express-validator'
import Appointment from '../models/Appointment.js'
import Doctor from '../models/Doctor.js'
import { auth } from '../middleware/auth.js'

const router = express.Router()

const normalizeDate = (dateString) => {
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) {
    return null
  }
  date.setHours(0, 0, 0, 0)
  return date
}

router.get(
  '/my',
  auth,
  async (req, res) => {
    try {
      const appointments = await Appointment.find({ user: req.user._id })
        .populate('doctor', 'name specialty consultationFee avatarUrl')
        .sort({ date: 1, slot: 1 })
        .limit(50)
        .lean()

      res.json({
        success: true,
        data: appointments
      })
    } catch (error) {
      console.error('Fetch user appointments error:', error)
      res.status(500).json({
        success: false,
        message: 'Failed to fetch appointments'
      })
    }
  }
)

router.post(
  '/',
  auth,
  [
    body('doctorId').isMongoId(),
    body('date').isISO8601().withMessage('Date must be in YYYY-MM-DD format'),
    body('slot').isString().trim().notEmpty(),
    body('mode').optional().isString(),
    body('reason').optional().isString(),
    body('locationLabel').optional().isString()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        })
      }

      const { doctorId, date, slot, reason, mode, locationLabel } = req.body
      const normalizedDate = normalizeDate(date)
      if (!normalizedDate) {
        return res.status(400).json({ success: false, message: 'Invalid date' })
      }

      const doctor = await Doctor.findById(doctorId)
      if (!doctor || !doctor.isActive) {
        return res.status(404).json({ success: false, message: 'Doctor not found' })
      }

      const dayAvailability = doctor.availability.filter((entry) => entry.dayOfWeek === normalizedDate.getDay())
      const slotExists = dayAvailability.some((entry) => entry.slots.includes(slot))

      if (!slotExists) {
        return res.status(400).json({
          success: false,
          message: 'Selected slot is not available for this doctor'
        })
      }

      const conflicting = await Appointment.findOne({
        doctor: doctor._id,
        date: normalizedDate,
        slot,
        status: { $ne: 'cancelled' }
      })

      if (conflicting) {
        return res.status(409).json({
          success: false,
          message: 'Slot already booked. Please choose another slot.'
        })
      }

      const appointment = await Appointment.create({
        user: req.user._id,
        doctor: doctor._id,
        date: normalizedDate,
        slot,
        reason,
        mode: mode || doctor.modes[0],
        locationLabel: locationLabel || doctor.locations[0]?.label || '',
        doctorSnapshot: {
          name: doctor.name,
          specialty: doctor.specialty,
          consultationFee: doctor.consultationFee
        }
      })

      res.status(201).json({
        success: true,
        message: 'Appointment booked successfully',
        data: appointment
      })
    } catch (error) {
      console.error('Create appointment error:', error)
      if (error.code === 11000) {
        return res.status(409).json({
          success: false,
          message: 'Slot already booked. Please choose another slot.'
        })
      }
      res.status(500).json({
        success: false,
        message: 'Failed to book appointment'
      })
    }
  }
)

router.patch(
  '/:id/cancel',
  auth,
  [param('id').isMongoId(), body('note').optional().isString()],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() })
      }

      const appointment = await Appointment.findOne({
        _id: req.params.id,
        user: req.user._id
      })

      if (!appointment) {
        return res.status(404).json({
          success: false,
          message: 'Appointment not found'
        })
      }

      appointment.status = 'cancelled'
      appointment.cancellationNote = req.body.note
      await appointment.save()

      res.json({
        success: true,
        message: 'Appointment cancelled',
        data: appointment
      })
    } catch (error) {
      console.error('Cancel appointment error:', error)
      res.status(500).json({
        success: false,
        message: 'Failed to cancel appointment'
      })
    }
  }
)

export default router

