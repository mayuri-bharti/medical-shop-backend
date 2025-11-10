import express from 'express'
import mongoose from 'mongoose'
import { query, validationResult } from 'express-validator'
import AllMedicine from '../models/AllMedicine.js'
import { connectDB } from '../src/db.js'
import { cache } from '../src/middleware/cache.js'

const router = express.Router()

const ensureDatabaseConnection = async () => {
  if (mongoose.connection.readyState === 1) {
    return
  }

  const mongoUrl = process.env.MONGO_URL || process.env.MONGODB_URI

  if (!mongoUrl) {
    throw new Error('MongoDB connection string not configured')
  }

  if (mongoose.connection.readyState === 0) {
    await connectDB(mongoUrl)
  } else if (mongoose.connection.readyState === 2) {
    await new Promise((resolve, reject) => {
      mongoose.connection.once('connected', resolve)
      mongoose.connection.once('error', reject)
      setTimeout(() => reject(new Error('MongoDB connection timeout')), 10000)
    })
  }
}

router.get(
  '/',
  cache(30),
  [
    query('search').optional().isString().trim(),
    query('category').optional().isString().trim(),
    query('page').optional().toInt().isInt({ min: 1 }),
    query('limit').optional().toInt().isInt({ min: 1, max: 100 })
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Invalid query parameters',
          errors: errors.array()
        })
      }

      await ensureDatabaseConnection()

      const {
        search = '',
        category,
        page = 1,
        limit = 30
      } = req.query

      const filter = { isActive: { $ne: false } }

      if (category) {
        filter.category = category
      }

      if (search) {
        filter.$or = [
          { name: { $regex: search, $options: 'i' } },
          { category: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
          { tags: { $elemMatch: { $regex: search, $options: 'i' } } }
        ]
      }

      const skip = (page - 1) * limit

      const [medicines, total] = await Promise.all([
        AllMedicine.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .select('-__v')
          .lean(),
        AllMedicine.countDocuments(filter)
      ])

      res.json({
        success: true,
        medicines,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      })
    } catch (error) {
      console.error('Failed to fetch all medicines:', error)
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch medicines'
      })
    }
  }
)

router.get('/:id', cache(300), async (req, res) => {
  try {
    await ensureDatabaseConnection()
    const medicine = await AllMedicine.findById(req.params.id)
      .select('-__v')
      .lean()

    if (!medicine) {
      return res.status(404).json({
        success: false,
        message: 'Medicine not found'
      })
    }

    res.json({
      success: true,
      medicine
    })
  } catch (error) {
    console.error('Failed to fetch medicine:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch medicine'
    })
  }
})

export default router

