import express from 'express'
import { body, param, query, validationResult } from 'express-validator'
import { verifyAdminToken } from '../../middleware/adminAuth.js'
import Doctor from '../../../models/Doctor.js'

const router = express.Router()

const availabilityValidators = [
  body('availability.*.dayOfWeek').isInt({ min: 0, max: 6 }),
  body('availability.*.slots').isArray({ min: 1 }),
  body('availability.*.slots.*').matches(/^\d{2}:\d{2}$/)
]

router.get(
  '/',
  verifyAdminToken,
  [
    query('active').optional().isBoolean().toBoolean(),
    query('specialty').optional().isString()
  ],
  async (req, res) => {
    try {
      const filter = {}
      if (req.query.active !== undefined) {
        filter.isActive = req.query.active
      }
      if (req.query.specialty) {
        filter.specialty = { $regex: req.query.specialty, $options: 'i' }
      }

      const doctors = await Doctor.find(filter).sort({ createdAt: -1 })
      res.json({ success: true, data: doctors })
    } catch (error) {
      console.error('Admin fetch doctors error:', error)
      res.status(500).json({ success: false, message: 'Failed to fetch doctors' })
    }
  }
)

router.post(
  '/',
  verifyAdminToken,
  [
    body('name').trim().notEmpty(),
    body('specialty').trim().notEmpty(),
    body('consultationFee').optional().isNumeric(),
    body('experienceYears').optional().isNumeric(),
    body('languages').optional().isArray(),
    body('locations').optional().isArray(),
    body('modes').optional().isArray(),
    ...availabilityValidators
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() })
      }

      const doctor = await Doctor.create(req.body)
      res.status(201).json({
        success: true,
        message: 'Doctor created successfully',
        data: doctor
      })
    } catch (error) {
      console.error('Create doctor error:', error)
      res.status(500).json({ success: false, message: 'Failed to create doctor' })
    }
  }
)

router.put(
  '/:id',
  verifyAdminToken,
  [
    param('id').isMongoId(),
    body('name').optional().trim().notEmpty(),
    body('specialty').optional().trim().notEmpty(),
    body('consultationFee').optional().isNumeric(),
    body('languages').optional().isArray(),
    body('modes').optional().isArray(),
    ...availabilityValidators
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() })
      }

      const doctor = await Doctor.findByIdAndUpdate(req.params.id, req.body, { new: true })
      if (!doctor) {
        return res.status(404).json({ success: false, message: 'Doctor not found' })
      }

      res.json({
        success: true,
        message: 'Doctor updated successfully',
        data: doctor
      })
    } catch (error) {
      console.error('Update doctor error:', error)
      res.status(500).json({ success: false, message: 'Failed to update doctor' })
    }
  }
)

router.patch(
  '/:id/status',
  verifyAdminToken,
  [param('id').isMongoId(), body('isActive').isBoolean()],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() })
      }

      const doctor = await Doctor.findById(req.params.id)
      if (!doctor) {
        return res.status(404).json({ success: false, message: 'Doctor not found' })
      }

      doctor.isActive = req.body.isActive
      await doctor.save()

      res.json({
        success: true,
        message: 'Doctor status updated',
        data: doctor
      })
    } catch (error) {
      console.error('Update doctor status error:', error)
      res.status(500).json({ success: false, message: 'Failed to update doctor status' })
    }
  }
)

export default router

