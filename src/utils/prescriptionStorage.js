import fs from 'fs'
import path from 'path'
import { uploadToCloudinary, isCloudinaryConfigured } from './cloudinary.js'

const runningOnVercel = Boolean(process.env.VERCEL)
const uploadsDir = path.join(process.cwd(), 'uploads', 'prescriptions')

const ensureLocalDirectory = () => {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true })
  }
}

const getSafeFileName = (originalName = 'prescription') => {
  const extension = path.extname(originalName) || ''
  const sanitizedExtension = extension.replace(/[^.\w]/g, '')
  return `prescription-${Date.now()}-${Math.round(Math.random() * 1e9)}${sanitizedExtension}`
}

export const storePrescriptionFile = async (file) => {
  if (!file) {
    throw new Error('No file provided for prescription upload')
  }

  // Validate file has buffer (required for multer memoryStorage)
  if (!file.buffer) {
    throw new Error('File buffer is missing. Ensure multer is configured with memoryStorage.')
  }

  // Try Cloudinary if configured, but allow fallback to local storage
  if (isCloudinaryConfigured()) {
    try {
      const result = await uploadToCloudinary(file.buffer, {
        folder: 'prescriptions',
        resource_type: 'auto',
        public_id: `prescription_${Date.now()}_${Math.round(Math.random() * 1e9)}`
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
      // Extract error message from various possible properties
      const errorMessage = cloudinaryError.message || 
                          cloudinaryError.error?.message || 
                          cloudinaryError.error || 
                          cloudinaryError.toString() || 
                          'Unknown Cloudinary error'
      
      // Always fall back to local storage if Cloudinary fails (unless on Vercel)
      if (!runningOnVercel) {
        console.warn('Cloudinary upload failed, falling back to local storage:', errorMessage)
        // Continue to local storage below
      } else {
        // On Vercel, Cloudinary is required
        throw new Error(`Cloudinary upload failed: ${errorMessage}`)
      }
    }
  }

  if (runningOnVercel) {
    throw new Error('Cloud storage required for prescription upload in this environment')
  }

  try {
    ensureLocalDirectory()
    const fileName = getSafeFileName(file.originalname)
    const targetPath = path.join(uploadsDir, fileName)

    await fs.promises.writeFile(targetPath, file.buffer)

    return {
      storage: 'local',
      url: `/uploads/prescriptions/${fileName}`,
      fileName
    }
  } catch (localError) {
    console.error('Local file save failed:', localError)
    throw new Error(`Failed to save file locally: ${localError.message}`)
  }
}

export default {
  storePrescriptionFile
}








