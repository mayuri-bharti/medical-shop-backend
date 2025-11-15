/**
 * Cloudinary utility for image upload
 */

import { v2 as cloudinary } from 'cloudinary'
import { Readable } from 'stream'
import fs from 'fs'
import path from 'path'

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

/**
 * Upload file to Cloudinary
 * @param {Buffer|Stream} file - File buffer or stream
 * @param {Object} options - Upload options
 * @returns {Promise<Object>} Cloudinary upload result
 */
export const uploadToCloudinary = async (file, options = {}) => {
  try {
    // Check if Cloudinary is configured
    if (!process.env.CLOUDINARY_CLOUD_NAME || 
        !process.env.CLOUDINARY_API_KEY || 
        !process.env.CLOUDINARY_API_SECRET) {
      throw new Error('Cloudinary is not configured. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET environment variables.')
    }

    const uploadOptions = {
      folder: 'prescriptions', // Store in prescriptions folder
      resource_type: 'auto', // Auto-detect image, video, or raw
      ...options
    }

    // If file is a buffer, convert to stream
    let fileStream
    if (Buffer.isBuffer(file)) {
      fileStream = Readable.from(file)
    } else {
      fileStream = file
    }

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error) {
            console.error('Cloudinary upload error:', error)
            // Create a more descriptive error object
            const errorDetails = {
              message: error.message || error.error?.message || error.error || 'Unknown Cloudinary error',
              http_code: error.http_code,
              name: error.name || 'CloudinaryUploadError',
              originalError: error
            }
            reject(new Error(errorDetails.message))
          } else {
            resolve(result)
          }
        }
      )

      fileStream.pipe(uploadStream)
      
      // Handle stream errors
      fileStream.on('error', (streamError) => {
        console.error('File stream error:', streamError)
        reject(new Error(`File stream error: ${streamError.message || streamError.toString()}`))
      })
      
      uploadStream.on('error', (uploadStreamError) => {
        console.error('Upload stream error:', uploadStreamError)
        reject(new Error(`Upload stream error: ${uploadStreamError.message || uploadStreamError.toString()}`))
      })
    })
  } catch (error) {
    console.error('Cloudinary upload error:', error)
    throw error
  }
}

/**
 * Upload file from multer file object
 * @param {Object} multerFile - Multer file object
 * @returns {Promise<Object>} Cloudinary upload result
 */
export const uploadMulterFile = async (multerFile) => {
  try {
    // Read file from disk
    const filePath = multerFile.path
    
    // Upload directly from file path (more efficient)
    return new Promise((resolve, reject) => {
      const uploadOptions = {
        folder: 'prescriptions',
        resource_type: 'auto',
        public_id: `prescription_${Date.now()}_${Math.round(Math.random() * 1E9)}`,
        format: path.extname(multerFile.originalname).slice(1), // Remove the dot
      }

      cloudinary.uploader.upload(
        filePath,
        uploadOptions,
        (error, result) => {
          // Delete local file after upload (whether success or failure)
          try {
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath)
            }
          } catch (deleteError) {
            console.warn('Failed to delete local file:', deleteError.message)
          }

          if (error) {
            console.error('Cloudinary upload error:', error)
            reject(error)
          } else {
            resolve(result)
          }
        }
      )
    })
  } catch (error) {
    console.error('Upload multer file error:', error)
    throw error
  }
}

/**
 * Delete file from Cloudinary
 * @param {string} publicId - Cloudinary public ID
 * @returns {Promise<Object>} Deletion result
 */
export const deleteFromCloudinary = async (publicId) => {
  try {
    if (!process.env.CLOUDINARY_CLOUD_NAME) {
      throw new Error('Cloudinary is not configured')
    }

    return await cloudinary.uploader.destroy(publicId)
  } catch (error) {
    console.error('Cloudinary delete error:', error)
    throw error
  }
}

/**
 * Get optimized image URL from Cloudinary
 * @param {string} publicId - Cloudinary public ID or URL
 * @param {Object} options - Transformation options
 * @returns {string} Optimized image URL
 */
export const getOptimizedUrl = (publicId, options = {}) => {
  if (!publicId) return null

  // If it's already a Cloudinary URL, return it
  if (publicId.startsWith('http')) {
    return publicId
  }

  // Build transformation options
  const transformations = {
    quality: 'auto',
    fetch_format: 'auto',
    ...options
  }

  return cloudinary.url(publicId, transformations)
}

export default {
  uploadToCloudinary,
  uploadMulterFile,
  deleteFromCloudinary,
  getOptimizedUrl
}

export const isCloudinaryConfigured = () => {
  // Check that all required env vars exist AND are non-empty strings
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME
  const apiKey = process.env.CLOUDINARY_API_KEY
  const apiSecret = process.env.CLOUDINARY_API_SECRET
  
  return Boolean(
    cloudName && cloudName.trim() !== '' &&
    apiKey && apiKey.trim() !== '' &&
    apiSecret && apiSecret.trim() !== ''
  )
}

