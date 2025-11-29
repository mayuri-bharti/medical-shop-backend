import fs from 'fs'
import path from 'path'
import { uploadToCloudinary, isCloudinaryConfigured } from './cloudinary.js'

const runningOnVercel = Boolean(process.env.VERCEL)
const uploadsDir = path.join(process.cwd(), 'uploads', 'avatars')

const ensureLocalDirectory = () => {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true })
  }
}

const getSafeFileName = (originalName = 'avatar') => {
  const extension = path.extname(originalName) || '.jpg'
  const sanitizedExtension = extension.replace(/[^.\w]/g, '')
  return `avatar-${Date.now()}-${Math.round(Math.random() * 1e9)}${sanitizedExtension}`
}

/**
 * Store avatar/profile picture
 * @param {Object} file - Multer file object with buffer
 * @returns {Promise<Object>} Storage result with url and fileName
 */
export const storeAvatarFile = async (file) => {
  if (!file) {
    throw new Error('No file provided for avatar upload')
  }

  // Validate file has buffer (required for multer memoryStorage)
  if (!file.buffer) {
    throw new Error('File buffer is missing. Ensure multer is configured with memoryStorage.')
  }

  // Validate file type (only images)
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
  if (!allowedTypes.includes(file.mimetype)) {
    throw new Error('Invalid file type. Only JPEG, PNG, JPG, WEBP, and GIF images are allowed.')
  }

  // Validate file size (max 5MB for avatars)
  const maxSize = 5 * 1024 * 1024 // 5MB
  if (file.size > maxSize) {
    throw new Error('File size too large. Maximum size is 5MB.')
  }

  // Try Cloudinary if configured
  if (isCloudinaryConfigured()) {
    try {
      const result = await uploadToCloudinary(file.buffer, {
        folder: 'avatars',
        resource_type: 'image',
        public_id: `avatar_${Date.now()}_${Math.round(Math.random() * 1e9)}`,
        transformation: [
          { width: 400, height: 400, crop: 'fill', gravity: 'face' },
          { quality: 'auto', fetch_format: 'auto' }
        ]
      })

      if (!result || !result.secure_url) {
        throw new Error('Cloudinary upload succeeded but returned invalid result')
      }

      return {
        storage: 'cloudinary',
        url: result.secure_url || result.url,
        fileName: result.original_filename || result.public_id,
        publicId: result.public_id
      }
    } catch (cloudinaryError) {
      console.error('Cloudinary upload failed:', cloudinaryError)
      const errorMessage = cloudinaryError.message || 
                          cloudinaryError.error?.message || 
                          cloudinaryError.error || 
                          cloudinaryError.toString() || 
                          'Unknown Cloudinary error'
      
      if (!runningOnVercel) {
        console.warn('Cloudinary upload failed, falling back to local storage:', errorMessage)
        // Continue to local storage below
      } else {
        throw new Error(`Cloudinary upload failed: ${errorMessage}`)
      }
    }
  }

  if (runningOnVercel) {
    throw new Error('Cloud storage required for avatar upload in this environment')
  }

  // Fallback to local storage
  try {
    ensureLocalDirectory()
    const fileName = getSafeFileName(file.originalname)
    const targetPath = path.join(uploadsDir, fileName)

    await fs.promises.writeFile(targetPath, file.buffer)

    return {
      storage: 'local',
      url: `/uploads/avatars/${fileName}`,
      fileName
    }
  } catch (localError) {
    console.error('Local file save failed:', localError)
    throw new Error(`Failed to save file locally: ${localError.message}`)
  }
}

export default {
  storeAvatarFile
}


