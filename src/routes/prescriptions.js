const express = require('express')
const multer = require('multer')
const { auth } = require('../middleware/auth')
const Prescription = require('../../models/Prescription')

const router = express.Router()

// Configure multer for file uploads
const storage = multer.memoryStorage()
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

/**
 * POST /prescriptions
 * Upload prescription
 */
router.post('/', auth, upload.single('prescription'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      })
    }

    // For demo, we'll create a simple response
    // In production, you would save to cloud storage
    const processingId = `PROC-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    // Create prescription document
    const prescription = new Prescription({
      user: req.user._id,
      fileName: req.file.originalname,
      originalName: req.file.originalname,
      fileUrl: `/uploads/prescriptions/${req.file.originalname}`, // Mock URL
      fileType: req.file.mimetype,
      fileSize: req.file.size,
      description: req.body.description || 'Uploaded prescription',
      status: 'pending'
    })

    await prescription.save()

    res.status(201).json({
      success: true,
      message: 'Prescription uploaded successfully',
      data: {
        processingId,
        prescriptionId: prescription._id,
        status: 'pending'
      }
    })
  } catch (error) {
    console.error('Upload prescription error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to upload prescription'
    })
  }
})

/**
 * GET /prescriptions
 * Get user's prescriptions
 */
router.get('/', auth, async (req, res) => {
  try {
    const prescriptions = await Prescription.find({
      user: req.user._id,
      isActive: true
    }).sort({ createdAt: -1 })

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

module.exports = router








