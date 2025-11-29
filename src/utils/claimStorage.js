import fs from 'fs'
import path from 'path'
import { uploadToCloudinary, isCloudinaryConfigured } from './cloudinary.js'

const runningOnVercel = Boolean(process.env.VERCEL)
const uploadsDir = path.join(process.cwd(), 'uploads', 'claims')

const ensureLocalDirectory = () => {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true })
  }
}

const getSafeFileName = (originalName = 'claim') => {
  const extension = path.extname(originalName) || '.jpg'
  const sanitizedExtension = extension.replace(/[^.\w]/g, '')
  return `claim-${Date.now()}-${Math.round(Math.random() * 1e9)}${sanitizedExtension}`
}

export const storeClaimImage = async (file) => {
  if (!file) {
    throw new Error('No file provided for claim image upload')
  }

  // Validate file has buffer (required for multer memoryStorage)
  if (!file.buffer) {
    throw new Error('File buffer is missing. Ensure multer is configured with memoryStorage.')
  }

  // Validate file type (only images)
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
  if (!allowedTypes.includes(file.mimetype)) {
    throw new Error('Invalid file type. Only JPEG, PNG, JPG, and WEBP images are allowed.')
  }

  // Validate file size (max 5MB)
  const maxSize = 5 * 1024 * 1024 // 5MB
  if (file.size > maxSize) {
    throw new Error('File size too large. Maximum size is 5MB.')
  }

  // Try Cloudinary if configured
  if (isCloudinaryConfigured()) {
    try {
      const result = await uploadToCloudinary(file.buffer, {
        folder: 'claims',
        resource_type: 'image',
        public_id: `claim_${Date.now()}_${Math.round(Math.random() * 1e9)}`,
        transformation: [
          { quality: 'auto', fetch_format: 'auto' }
        ]
      })

      if (!result || !result.secure_url) {
        throw new Error('Cloudinary upload succeeded but returned invalid result')
      }

      return {
        storage: 'cloudinary',
        url: result.secure_url || result.url,
        filename: result.original_filename || result.public_id,
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
      } else {
        throw new Error(`Cloudinary upload failed: ${errorMessage}`)
      }
    }
  }

  if (runningOnVercel) {
    throw new Error('Cloud storage required for claim image upload in this environment')
  }

  // Fallback to local storage
  try {
    ensureLocalDirectory()
    const fileName = getSafeFileName(file.originalname)
    const targetPath = path.join(uploadsDir, fileName)

    await fs.promises.writeFile(targetPath, file.buffer)

    return {
      storage: 'local',
      url: `/uploads/claims/${fileName}`,
      filename: fileName
    }
  } catch (localError) {
    console.error('Local file save failed:', localError)
    throw new Error(`Failed to save file locally: ${localError.message}`)
  }
}

export default {
  storeClaimImage
}

