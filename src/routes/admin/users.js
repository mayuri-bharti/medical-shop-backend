import express from 'express'
import { body, validationResult } from 'express-validator'
import { verifyAdminToken } from '../../middleware/adminAuth.js'
import User from '../../../models/User.js'
import Admin from '../../../models/Admin.js'

const router = express.Router()

/**
 * GET /admin/users
 * Get all users (admin only)
 * Status codes: 200 (success), 403 (not admin), 500 (error)
 */
router.get('/', verifyAdminToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 50
    const skip = (page - 1) * limit

    const filter = {}
    
    // Search filter
    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search, 'i')
      filter.$or = [
        { phone: searchRegex },
        { email: searchRegex },
        { name: searchRegex }
      ]
    }
    
    // Role filter
    if (req.query.role) {
      filter.role = req.query.role
    }

    const users = await User.find(filter)
      .select('-password -__v')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)

    const total = await User.countDocuments(filter)

    res.json({
      success: true,
      users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Get admin users error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users'
    })
  }
})

/**
 * POST /admin/users/create-admin
 * Create a new admin (admin only)
 * Requires: phone, name, username, email, password
 * Status codes: 201 (created), 400 (validation error), 403 (not admin), 409 (already exists), 500 (error)
 */
router.post('/create-admin', verifyAdminToken, async (req, res) => {
  try {
    const { phone, name, username, email, password } = req.body

    // Validation
    if (!phone) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required'
      })
    }

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Name is required'
      })
    }

    if (!username) {
      return res.status(400).json({
        success: false,
        message: 'Username is required'
      })
    }

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      })
    }

    if (!password || password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password is required and must be at least 6 characters'
      })
    }

    // Check if admin already exists with phone, email, or username
    const existingAdmin = await Admin.findOne({
      $or: [
        { phone },
        { email: email.toLowerCase() },
        { username: username.toLowerCase() }
      ]
    })

    if (existingAdmin) {
      let conflictField = 'phone'
      if (existingAdmin.email === email.toLowerCase()) conflictField = 'email'
      if (existingAdmin.username === username.toLowerCase()) conflictField = 'username'
      
      return res.status(409).json({
        success: false,
        message: `Admin with this ${conflictField} already exists`
      })
    }

    // Create new admin
    const newAdmin = new Admin({
      phone,
      name,
      username: username.toLowerCase(),
      email: email.toLowerCase(),
      password, // Will be hashed by mongoose pre-save hook
      isAdmin: true
    })

    await newAdmin.save()

    // Remove password from response
    const adminResponse = newAdmin.toJSON()

    res.status(201).json({
      success: true,
      message: 'Admin created successfully',
      admin: adminResponse
    })
  } catch (error) {
    console.error('Create admin error:', error)
    
    if (error.code === 11000) {
      // Duplicate key error
      const field = Object.keys(error.keyPattern)[0]
      return res.status(409).json({
        success: false,
        message: `Admin with this ${field} already exists`
      })
    }

    res.status(500).json({
      success: false,
      message: 'Failed to create admin',
      error: error.message
    })
  }
})

/**
 * PUT /admin/users/:id
 * Update user details (admin only)
 * Status codes: 200 (success), 400 (validation error), 403 (not admin), 404 (not found), 500 (error)
 */
router.put('/:id', verifyAdminToken, [
  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Name cannot be empty'),
  body('email')
    .optional()
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
  body('phone')
    .optional()
    .trim()
    .matches(/^[0-9]{10}$/)
    .withMessage('Phone must be 10 digits'),
  body('password')
    .optional()
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters')
], async (req, res) => {
  try {
    // Validate input
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      })
    }

    const { id } = req.params
    const { name, email, phone, password } = req.body

    // Find user
    const user = await User.findById(id)
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      })
    }

    // Prevent updating the currently logged-in admin (if they're a user)
    // Note: Admins are in Admin collection, but check for safety
    if (req.adminId && req.adminId.toString() === id) {
      return res.status(403).json({
        success: false,
        message: 'Cannot update your own account through user management'
      })
    }

    // Update fields if provided
    if (name !== undefined) user.name = name
    if (email !== undefined) user.email = email.toLowerCase()
    if (phone !== undefined) {
      // Check if phone already exists for another user
      const existingUser = await User.findOne({ phone, _id: { $ne: id } })
      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: 'Phone number already exists'
        })
      }
      user.phone = phone
    }
    if (password !== undefined) {
      user.password = password // Will be hashed by mongoose pre-save hook
    }

    await user.save()

    // Return updated user (without password)
    const updatedUser = user.toJSON()

    res.json({
      success: true,
      message: 'User updated successfully',
      user: updatedUser
    })
  } catch (error) {
    console.error('Update user error:', error)
    
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0]
      return res.status(409).json({
        success: false,
        message: `User with this ${field} already exists`
      })
    }

    res.status(500).json({
      success: false,
      message: 'Failed to update user',
      error: error.message
    })
  }
})

/**
 * DELETE /admin/users/:id
 * Delete user permanently (admin only)
 * Status codes: 200 (success), 403 (not admin), 404 (not found), 500 (error)
 */
router.delete('/:id', verifyAdminToken, async (req, res) => {
  try {
    const { id } = req.params

    // Find user
    const user = await User.findById(id)
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      })
    }

    // Prevent deleting the currently logged-in admin (if they're a user)
    // Note: Admins are in Admin collection, but check for safety
    if (req.adminId && req.adminId.toString() === id) {
      return res.status(403).json({
        success: false,
        message: 'Cannot delete your own account'
      })
    }

    // Delete user
    await User.findByIdAndDelete(id)

    res.json({
      success: true,
      message: 'User deleted successfully'
    })
  } catch (error) {
    console.error('Delete user error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to delete user',
      error: error.message
    })
  }
})

/**
 * PATCH /admin/users/:id/block
 * Toggle user blocked status (admin only)
 * Status codes: 200 (success), 403 (not admin), 404 (not found), 500 (error)
 */
router.patch('/:id/block', verifyAdminToken, async (req, res) => {
  try {
    const { id } = req.params
    const { isBlocked } = req.body

    // Find user
    const user = await User.findById(id)
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      })
    }

    // Prevent blocking the currently logged-in admin (if they're a user)
    if (req.adminId && req.adminId.toString() === id) {
      return res.status(403).json({
        success: false,
        message: 'Cannot block your own account'
      })
    }

    // Update blocked status
    user.isBlocked = isBlocked !== undefined ? isBlocked : !user.isBlocked
    await user.save()

    // Return updated user
    const updatedUser = user.toJSON()

    res.json({
      success: true,
      message: `User ${user.isBlocked ? 'blocked' : 'unblocked'} successfully`,
      user: updatedUser
    })
  } catch (error) {
    console.error('Block user error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to update user block status',
      error: error.message
    })
  }
})

export default router



