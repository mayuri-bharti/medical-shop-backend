import express from 'express'
import multer from 'multer'
import { auth } from '../middleware/auth.js'
import Prescription from '../../models/Prescription.js'
import fs from 'fs'
import path from 'path'
import jwt from 'jsonwebtoken'
import User from '../../models/User.js'
import Admin from '../../models/Admin.js'
import { storePrescriptionFile } from '../utils/prescriptionStorage.js'

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

    const { description, doctorName, patientName, prescriptionDate } = req.body

    // Actually save the file using storePrescriptionFile
    let fileMetadata
    try {
      fileMetadata = await storePrescriptionFile(req.file)
    } catch (storageError) {
      console.error('Prescription upload error:', storageError)
      console.error('Storage error details:', {
        message: storageError.message,
        stack: storageError.stack,
        fileSize: req.file?.size,
        fileName: req.file?.originalname,
        hasBuffer: !!req.file?.buffer,
        mimetype: req.file?.mimetype
      })
      return res.status(500).json({
        success: false,
        message: storageError.message || 'Failed to upload prescription file'
      })
    }

    // Validate fileMetadata was returned correctly
    if (!fileMetadata || !fileMetadata.fileName || !fileMetadata.url) {
      console.error('Invalid fileMetadata returned:', fileMetadata)
      return res.status(500).json({
        success: false,
        message: 'File upload succeeded but metadata is invalid'
      })
    }

    // Create prescription document with actual file metadata
    const prescription = new Prescription({
      user: req.user._id,
      fileName: fileMetadata.fileName,  // Use the generated safe filename
      originalName: req.file.originalname,
      fileUrl: fileMetadata.url,  // Use the actual URL from storage
      cloudinaryPublicId: fileMetadata.publicId || undefined,  // Only set if exists
      fileType: req.file.mimetype,
      fileSize: req.file.size,
      description: description || undefined,
      doctorName: doctorName || undefined,
      patientName: patientName || undefined,
      prescriptionDate: prescriptionDate ? new Date(prescriptionDate) : undefined,
      status: 'submitted'
    })

    await prescription.save()

    res.status(201).json({
      success: true,
      message: 'Prescription uploaded successfully',
      data: prescription
    })
  } catch (error) {
    console.error('Upload prescription error:', error)
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    })
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to upload prescription'
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

/**
 * Custom auth middleware for file serving that accepts token via query parameter
 * This is needed because <img> tags can't send Authorization headers
 */
const fileAuth = async (req, res, next) => {
  try {
    let token = null
    
    // Try to get token from Authorization header first
    const authHeader = req.header('Authorization')
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7)
    }
    
    // Fallback: get token from query parameter (for image requests)
    if (!token) {
      // Try standard Express query parsing first
      if (req.query && req.query.token) {
        token = req.query.token
      }
      // If still not found, parse from URL manually (fallback for edge cases)
      if (!token && (req.originalUrl || req.url)) {
        const urlToParse = req.originalUrl || req.url
        // Match token parameter, handling URL encoding
        const urlMatch = urlToParse.match(/[?&]token=([^&]*)/)
        if (urlMatch && urlMatch[1]) {
          try {
            token = decodeURIComponent(urlMatch[1])
          } catch (e) {
            // If decoding fails, use raw value
            token = urlMatch[1]
          }
        }
      }
      
      // Debug logging (only in development)
      if (!token && process.env.NODE_ENV === 'development') {
        console.log('FileAuth Debug - No token found:', {
          hasQuery: !!req.query,
          queryKeys: req.query ? Object.keys(req.query) : [],
          url: req.url,
          originalUrl: req.originalUrl,
          headers: Object.keys(req.headers)
        })
      }
    }
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No valid token provided.'
      })
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    
    // Check if it's an admin token or regular user token
    let user = null
    if (decoded.role === 'ADMIN') {
      // Look up admin in Admin model
      const admin = await Admin.findById(decoded.userId)
      if (!admin) {
        return res.status(401).json({
          success: false,
          message: 'Invalid token. Admin not found.'
        })
      }
      // Convert admin to user-like object for compatibility
      user = {
        _id: admin._id,
        role: 'ADMIN',
        isAdmin: true
      }
    } else {
      // Look up regular user in User model
      user = await User.findById(decoded.userId)
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid token. User not found.'
        })
      }
    }

    // Attach user to request object
    req.user = user
    req.userId = user._id
    
    next()
  } catch (error) {
    console.error('FileAuth Error:', error.message, error.name)
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token.'
      })
    }
    
    return res.status(500).json({
      success: false,
      message: 'Authentication error.'
    })
  }
}

/**
 * GET /prescriptions/:id/file
 * Serve prescription file with authentication (inline viewing)
 */
router.get('/:id/file', fileAuth, async (req, res) => {
  try {
    const prescription = await Prescription.findById(req.params.id)
    
    if (!prescription) {
      return res.status(404).json({
        success: false,
        message: 'Prescription not found'
      })
    }

    // Check if user owns the prescription or is admin
    const isOwner = prescription.user.toString() === req.user._id.toString()
    const isAdmin = req.user.role === 'ADMIN' || req.user.role === 'admin' || req.user.isAdmin
    
    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      })
    }

    // If it's a Cloudinary URL, redirect to it
    if (prescription.fileUrl && prescription.fileUrl.startsWith('http')) {
      return res.redirect(prescription.fileUrl)
    }

    // Serve local file
    const filePath = path.join(
      process.cwd(),
      'uploads',
      'prescriptions',
      prescription.fileName
    )

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      })
    }

    // Set appropriate headers for inline viewing
    res.setHeader('Content-Type', prescription.fileType || 'application/octet-stream')
    res.setHeader('Content-Disposition', `inline; filename="${prescription.originalName}"`)
    
    // Stream the file
    const fileStream = fs.createReadStream(filePath)
    fileStream.pipe(res)
  } catch (error) {
    console.error('Serve prescription file error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to serve prescription file'
    })
  }
})

/**
 * GET /prescriptions/:id/download
 * Download prescription file with authentication (attachment)
 */
router.get('/:id/download', fileAuth, async (req, res) => {
  try {
    const prescription = await Prescription.findById(req.params.id)
    
    if (!prescription) {
      return res.status(404).json({
        success: false,
        message: 'Prescription not found'
      })
    }

    // Check if user owns the prescription or is admin
    const isOwner = prescription.user.toString() === req.user._id.toString()
    const isAdmin = req.user.role === 'ADMIN' || req.user.role === 'admin' || req.user.isAdmin
    
    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      })
    }

    // If it's a Cloudinary URL, fetch and stream it with download headers
    if (prescription.fileUrl && prescription.fileUrl.startsWith('http')) {
      try {
        // Fetch the file from Cloudinary
        const response = await fetch(prescription.fileUrl)
        
        if (!response.ok) {
          throw new Error('Failed to fetch file from Cloudinary')
        }
        
        // Set download headers
        res.setHeader('Content-Type', prescription.fileType || response.headers.get('content-type') || 'application/octet-stream')
        res.setHeader('Content-Disposition', `attachment; filename="${prescription.originalName}"`)
        
        // Stream the file to the client
        const buffer = await response.arrayBuffer()
        res.send(Buffer.from(buffer))
        return
      } catch (fetchError) {
        console.error('Error fetching from Cloudinary:', fetchError)
        // Fallback: redirect to Cloudinary URL with download parameter
        const separator = prescription.fileUrl.includes('?') ? '&' : '?'
        const downloadUrl = `${prescription.fileUrl}${separator}fl_attachment`
        return res.redirect(downloadUrl)
      }
    }

    // Serve local file
    const filePath = path.join(
      process.cwd(),
      'uploads',
      'prescriptions',
      prescription.fileName
    )

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      })
    }

    // Set appropriate headers for download
    res.setHeader('Content-Type', prescription.fileType || 'application/octet-stream')
    res.setHeader('Content-Disposition', `attachment; filename="${prescription.originalName}"`)
    
    // Stream the file
    const fileStream = fs.createReadStream(filePath)
    fileStream.pipe(res)
  } catch (error) {
    console.error('Download prescription file error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to download prescription file'
    })
  }
})

/**
 * DELETE /prescriptions/:id
 * Delete (soft delete) prescription
 */
router.delete('/:id', auth, async (req, res) => {
  try {
    const prescription = await Prescription.findOne({ 
      _id: req.params.id, 
      user: req.user._id 
    })

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








