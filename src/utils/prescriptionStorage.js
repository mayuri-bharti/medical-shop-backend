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

  if (isCloudinaryConfigured()) {
    const result = await uploadToCloudinary(file.buffer, {
      folder: 'prescriptions',
      resource_type: 'auto',
      public_id: `prescription_${Date.now()}_${Math.round(Math.random() * 1e9)}`
    })

    return {
      storage: 'cloudinary',
      url: result.secure_url || result.url,
      fileName: result.original_filename || result.public_id,
      publicId: result.public_id
    }
  }

  if (runningOnVercel) {
    throw new Error('Cloud storage required for prescription upload in this environment')
  }

  ensureLocalDirectory()
  const fileName = getSafeFileName(file.originalname)
  const targetPath = path.join(uploadsDir, fileName)

  await fs.promises.writeFile(targetPath, file.buffer)

  return {
    storage: 'local',
    url: `/uploads/prescriptions/${fileName}`,
    fileName
  }
}

export default {
  storePrescriptionFile
}






