import express from 'express'
import { body, validationResult } from 'express-validator'
import User from '../models/User.js'

const router = express.Router()

const addressValidations = [
  body('name').trim().isLength({ min: 2 }).withMessage('Name is required'),
  body('phoneNumber').trim().isLength({ min: 10, max: 15 }).withMessage('Valid phone number is required'),
  body('address').trim().isLength({ min: 5 }).withMessage('Address is required'),
  body('city').trim().notEmpty().withMessage('City is required'),
  body('state').trim().notEmpty().withMessage('State is required'),
  body('pincode').trim().matches(/^\d{6}$/).withMessage('Valid pincode is required'),
  body('label').optional().trim(),
  body('landmark').optional().trim(),
  body('isDefault').optional().isBoolean(),
  body('setAsDefault').optional().isBoolean()
]

const formatAddressResponse = (user) => ({
  success: true,
  data: user.addresses?.map((addr) => ({
    ...addr.toObject(),
    id: addr._id,
    isDefault: user.defaultAddressId?.toString() === addr._id.toString()
  })) || [],
  defaultAddressId: user.defaultAddressId || null
})

const setDefaultAddress = (user, addressId) => {
  if (!addressId) return
  user.defaultAddressId = addressId
  user.addresses = user.addresses.map((addr) => {
    if (addr._id.toString() === addressId.toString()) {
      addr.isDefault = true
    } else if (addr.isDefault) {
      addr.isDefault = false
    }
    return addr
  })
}

router.get('/', async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' })
    }
    return res.json(formatAddressResponse(user))
  } catch (error) {
    console.error('Fetch addresses error:', error)
    return res.status(500).json({ success: false, message: 'Failed to fetch addresses' })
  }
})

router.post('/', addressValidations, async (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    })
  }

  try {
    const user = await User.findById(req.user._id)
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' })
    }

    const newAddress = {
      label: req.body.label?.trim() || 'Home',
      name: req.body.name.trim(),
      phoneNumber: req.body.phoneNumber.trim(),
      address: req.body.address.trim(),
      city: req.body.city.trim(),
      state: req.body.state.trim(),
      pincode: req.body.pincode.trim(),
      landmark: req.body.landmark?.trim() || ''
    }

    user.addresses.push(newAddress)
    const createdAddress = user.addresses[user.addresses.length - 1]

    if (!user.defaultAddressId || req.body.isDefault || req.body.setAsDefault) {
      setDefaultAddress(user, createdAddress._id)
    }

    await user.save()
    return res.status(201).json(formatAddressResponse(user))
  } catch (error) {
    console.error('Create address error:', error)
    return res.status(500).json({ success: false, message: 'Failed to save address' })
  }
})

router.put('/:id', addressValidations, async (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    })
  }

  try {
    const user = await User.findById(req.user._id)
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' })
    }

    const address = user.addresses.id(req.params.id)
    if (!address) {
      return res.status(404).json({ success: false, message: 'Address not found' })
    }

    address.label = req.body.label?.trim() || address.label
    address.name = req.body.name.trim()
    address.phoneNumber = req.body.phoneNumber.trim()
    address.address = req.body.address.trim()
    address.city = req.body.city.trim()
    address.state = req.body.state.trim()
    address.pincode = req.body.pincode.trim()
    address.landmark = req.body.landmark?.trim() || ''

    if (req.body.isDefault || req.body.setAsDefault) {
      setDefaultAddress(user, address._id)
    }

    await user.save()
    return res.json(formatAddressResponse(user))
  } catch (error) {
    console.error('Update address error:', error)
    return res.status(500).json({ success: false, message: 'Failed to update address' })
  }
})

router.patch('/:id/default', async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' })
    }

    const address = user.addresses.id(req.params.id)
    if (!address) {
      return res.status(404).json({ success: false, message: 'Address not found' })
    }

    setDefaultAddress(user, address._id)
    await user.save()

    return res.json(formatAddressResponse(user))
  } catch (error) {
    console.error('Set default address error:', error)
    return res.status(500).json({ success: false, message: 'Failed to update default address' })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    // Fetch fresh user document to ensure subdocuments are accessible
    const user = await User.findById(req.user._id)
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' })
    }

    const addressId = req.params.id
    if (!addressId || !addressId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ success: false, message: 'Invalid address ID format' })
    }

    // Find the address using id() method
    const address = user.addresses.id(addressId)
    if (!address) {
      return res.status(404).json({ success: false, message: 'Address not found' })
    }

    const removedIsDefault = user.defaultAddressId?.toString() === address._id.toString()
    
    // Remove the address subdocument using pull (preferred method for array subdocuments)
    user.addresses.pull(addressId)

    // Update default address if needed
    if (removedIsDefault) {
      const nextDefault = user.addresses[0]
      if (nextDefault) {
        setDefaultAddress(user, nextDefault._id)
      } else {
        user.defaultAddressId = null
      }
    }

    // Save the user document
    await user.save()
    
    return res.json(formatAddressResponse(user))
  } catch (error) {
    console.error('Delete address error:', error)
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      addressId: req.params.id,
      userId: req.user?._id
    })
    return res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to delete address' 
    })
  }
})

export default router

