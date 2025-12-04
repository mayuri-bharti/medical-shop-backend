import fs from 'fs'
import path from 'path'
import { uploadToCloudinary, isCloudinaryConfigured } from './cloudinary.js'

const runningOnVercel = Boolean(process.env.VERCEL)
const uploadsDir = path.join(process.cwd(), 'uploads', 'banners')

const ensureLocalDirectory = () => {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true })
  }
}

const getSafeFileName = (originalName = 'banner') => {
  const timestamp = Date.now()
  const random = Math.round(Math.random() * 1e9)
  const sanitizedName = originalName.replace(/[^a-zA-Z0-9.-]/g, '_')
  const extension = path.extname(originalName) || '.jpg'
  return `banner-${timestamp}-${random}${extension}`
}

export const storeBannerImage = async (file) => {
  if (!file) {
    throw new Error('No file provided for banner image upload')
  }

  // Validate file has buffer (required for multer memoryStorage)
  if (!file.buffer) {
    throw new Error('File buffer is missing. Ensure multer is configured with memoryStorage.')
  }

  // Try Cloudinary if configured
  if (isCloudinaryConfigured()) {
    try {
      const result = await uploadToCloudinary(file.buffer, {
        folder: 'banners',
        resource_type: 'image',
        public_id: `banner_${Date.now()}_${Math.round(Math.random() * 1e9)}`,
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
    throw new Error('Cloud storage required for banner image upload in this environment')
  }

  // Fallback to local storage
  try {
    ensureLocalDirectory()
    const fileName = getSafeFileName(file.originalname)
    const targetPath = path.join(uploadsDir, fileName)

    await fs.promises.writeFile(targetPath, file.buffer)

    return {
      storage: 'local',
      url: `/uploads/banners/${fileName}`,
      filename: fileName
    }
  } catch (localError) {
    console.error('Local file save failed:', localError)
    throw new Error(`Failed to save file locally: ${localError.message}`)
  }
}

export default {
  storeBannerImage
}


