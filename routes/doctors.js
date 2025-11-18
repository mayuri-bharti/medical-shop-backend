import express from 'express'
import { query, param, validationResult } from 'express-validator'
import Doctor from '../models/Doctor.js'
import Appointment from '../models/Appointment.js'

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
  '/',
  [
    query('specialty').optional().isString(),
    query('city').optional().isString(),
    query('search').optional().isString(),
    query('limit').optional().isInt({ min: 1, max: 100 })
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

      const { specialty, city, search } = req.query
      const limit = parseInt(req.query.limit) || 30

      const filter = { isActive: true }

      if (specialty) {
        filter.specialty = { $regex: specialty, $options: 'i' }
      }
      if (city) {
        filter['locations.city'] = { $regex: city, $options: 'i' }
      }
      if (search) {
        filter.$or = [
          { name: { $regex: search, $options: 'i' } },
          { specialty: { $regex: search, $options: 'i' } },
          { tags: { $regex: search, $options: 'i' } },
          { languages: { $regex: search, $options: 'i' } }
        ]
      }

      const doctors = await Doctor.find(filter)
        .sort({ rating: -1, experienceYears: -1 })
        .limit(limit)
        .select('-__v')

      res.json({
        success: true,
        data: doctors
      })
    } catch (error) {
      console.error('Fetch doctors error:', error)
      res.status(500).json({
        success: false,
        message: 'Failed to fetch doctors'
      })
    }
  }
)

router.get('/specialties', async (req, res) => {
  try {
    const specialties = await Doctor.distinct('specialty', { isActive: true })
    res.json({
      success: true,
      data: specialties.sort()
    })
  } catch (error) {
    console.error('Fetch specialties error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch specialties'
    })
  }
})

router.get(
  '/:id',
  [param('id').isMongoId()],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() })
      }

      const doctor = await Doctor.findById(req.params.id).select('-__v')
      if (!doctor || !doctor.isActive) {
        return res.status(404).json({
          success: false,
          message: 'Doctor not found'
        })
      }

      res.json({ success: true, data: doctor })
    } catch (error) {
      console.error('Fetch doctor error:', error)
      res.status(500).json({
        success: false,
        message: 'Failed to fetch doctor'
      })
    }
  }
)

router.get(
  '/:id/slots',
  [
    param('id').isMongoId(),
    query('date').optional().isISO8601().withMessage('Date must be ISO8601 (YYYY-MM-DD)')
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

      const doctor = await Doctor.findById(req.params.id).select('availability modes locations')
      if (!doctor) {
        return res.status(404).json({ success: false, message: 'Doctor not found' })
      }

      const dateParam = req.query.date || new Date().toISOString().slice(0, 10)
      const normalizedDate = normalizeDate(dateParam)

      if (!normalizedDate) {
        return res.status(400).json({
          success: false,
          message: 'Invalid date'
        })
      }

      const dayOfWeek = normalizedDate.getDay()
      const dayAvailability = doctor.availability.filter((slot) => slot.dayOfWeek === dayOfWeek)

      if (!dayAvailability.length) {
        return res.json({
          success: true,
          data: []
        })
      }

      const takenSlots = await Appointment.find({
        doctor: doctor._id,
        date: normalizedDate,
        status: { $ne: 'cancelled' }
      })
        .select('slot')
        .lean()

      const unavailableSet = new Set(takenSlots.map((slot) => slot.slot))

      const response = dayAvailability.map((entry) => ({
        mode: entry.mode,
        locationLabel: entry.locationLabel,
        slots: entry.slots.filter((slot) => !unavailableSet.has(slot))
      }))

      res.json({
        success: true,
        data: response
      })
    } catch (error) {
      console.error('Fetch slots error:', error)
      res.status(500).json({
        success: false,
        message: 'Failed to fetch slots'
      })
    }
  }
)

export default router

