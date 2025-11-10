import express from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { body, validationResult } from 'express-validator'
import Prescription from '../models/Prescription.js'
import { auth } from '../middleware/auth.js'
import { uploadToCloudinary } from '../src/utils/cloudinary.js'

const router = express.Router()

const runningOnVercel = Boolean(process.env.VERCEL)

const isCloudinaryConfigured = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
)

let storage

if (isCloudinaryConfigured) {
  storage = multer.memoryStorage()
} else {
  const uploadsDir = path.join(process.cwd(), 'uploads', 'prescriptions')
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true })
  }

  storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadsDir)
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
      cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname))
    }
  })
}

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf']
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, JPG, and PDF files are allowed.'))
    }
  }
})

// Get user's prescriptions
router.get('/', auth, async (req, res) => {
  try {
    const prescriptions = await Prescription.find({
      user: req.user._id,
      isActive: true
    })
      .populate('order', 'orderNumber status total deliveryDate createdAt source paymentMethod')
      .sort({ createdAt: -1 })

    res.json({
      success: true,
      data: prescriptions
    })
  } catch (error) {
    console.error('Get prescriptions error:', error)
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch prescriptions' 
    })
  }
})

// Get single prescription
router.get('/:id', auth, async (req, res) => {
  try {
    const prescription = await Prescription.findOne({
      _id: req.params.id,
      user: req.user._id
    })
      .populate('order', 'orderNumber status total deliveryDate createdAt source paymentMethod')

    if (!prescription) {
      return res.status(404).json({ message: 'Prescription not found' })
    }

    res.json(prescription)
  } catch (error) {
    console.error('Get prescription error:', error)
    res.status(500).json({ message: 'Failed to fetch prescription' })
  }
})

// Upload prescription
router.post('/', auth, upload.single('prescription'), [
  body('description').optional().isString().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed',
        errors: errors.array()
      })
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' })
    }

    const { description, doctorName, patientName, prescriptionDate } = req.body

    if (runningOnVercel && !isCloudinaryConfigured) {
      console.error('Prescription upload attempted on Vercel without Cloudinary configuration.')
      return res.status(500).json({
        success: false,
        message: 'Prescription upload requires cloud storage. Please configure Cloudinary environment variables.'
      })
    }

    let fileUrl = ''
    let fileName = ''
    let cloudinaryPublicId = undefined

    if (isCloudinaryConfigured) {
      try {
        const uploadResult = await uploadToCloudinary(req.file.buffer, {
          folder: 'prescriptions',
          resource_type: 'auto',
          public_id: `prescription_${Date.now()}_${Math.round(Math.random() * 1E9)}`
        })

        fileUrl = uploadResult.secure_url || uploadResult.url
        fileName = uploadResult.public_id || req.file.originalname
        cloudinaryPublicId = uploadResult.public_id
      } catch (cloudError) {
        console.error('Prescription Cloudinary upload error:', cloudError)
        return res.status(500).json({
          success: false,
          message: 'Failed to upload prescription file'
        })
      }
    } else {
      fileUrl = `/uploads/prescriptions/${req.file.filename}`
      fileName = req.file.filename
    }

    const prescription = new Prescription({
      user: req.user._id,
      fileName,
      originalName: req.file.originalname,
      fileUrl,
      cloudinaryPublicId,
      fileType: req.file.mimetype,
      fileSize: req.file.size,
      description,
      doctorName,
      patientName,
      prescriptionDate: prescriptionDate ? new Date(prescriptionDate) : undefined
    })

    await prescription.save()

    res.status(201).json({
      success: true,
      message: 'Prescription uploaded successfully',
      data: prescription
    })
  } catch (error) {
    console.error('Upload prescription error:', error)
    res.status(500).json({ 
      success: false,
      message: error.message || 'Failed to upload prescription' 
    })
  }
})

// Update prescription
router.put('/:id', auth, [
  body('description').optional().isString().trim(),
  body('doctorName').optional().isString().trim(),
  body('patientName').optional().isString().trim(),
  body('prescriptionDate').optional().isISO8601()
], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed',
        errors: errors.array()
      })
    }

    const prescription = await Prescription.findOne({ 
      _id: req.params.id, 
      user: req.user._id 
    })

    if (!prescription) {
      return res.status(404).json({ message: 'Prescription not found' })
    }

    const updates = {}
    if (req.body.description !== undefined) updates.description = req.body.description
    if (req.body.doctorName !== undefined) updates.doctorName = req.body.doctorName
    if (req.body.patientName !== undefined) updates.patientName = req.body.patientName
    if (req.body.prescriptionDate !== undefined) updates.prescriptionDate = new Date(req.body.prescriptionDate)

    const updatedPrescription = await Prescription.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    )

    res.json(updatedPrescription)
  } catch (error) {
    console.error('Update prescription error:', error)
    res.status(500).json({ message: 'Failed to update prescription' })
  }
})

// Delete prescription
router.delete('/:id', auth, async (req, res) => {
  try {
    const prescription = await Prescription.findOne({ 
      _id: req.params.id, 
      user: req.user._id 
    })

    if (!prescription) {
      return res.status(404).json({ message: 'Prescription not found' })
    }

    prescription.isActive = false
    await prescription.save()

    res.json({ message: 'Prescription deleted successfully' })
  } catch (error) {
    console.error('Delete prescription error:', error)
    res.status(500).json({ message: 'Failed to delete prescription' })
  }
})

export default router




