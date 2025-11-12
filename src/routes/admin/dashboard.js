import express from 'express'
import { verifyAdminToken } from '../../middleware/adminAuth.js'
import Order from '../../../models/Order.js'
import Product from '../../../models/Product.js'
import User from '../../../models/User.js'

const router = express.Router()

router.get('/stats', verifyAdminToken, async (req, res) => {
  try {
    const [
      totalProducts,
      totalUsers,
      totalOrders,
      revenueByStatus,
      revenueByPaymentStatus,
      recentOrders,
      topProducts
    ] = await Promise.all([
      Product.countDocuments(),
      User.countDocuments(),
      Order.countDocuments(),
      Order.aggregate([
        {
          $group: {
            _id: '$status',
            revenue: { $sum: '$total' },
            orders: { $sum: 1 }
          }
        }
      ]),
      Order.aggregate([
        {
          $group: {
            _id: '$paymentStatus',
            revenue: { $sum: '$total' },
            orders: { $sum: 1 }
          }
        }
      ]),
      Order.find({})
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('user', 'name phone email')
        .populate('prescription', 'status fileUrl originalName')
        .select('orderNumber total status paymentStatus createdAt prescription')
        .lean(),
      Order.aggregate([
        { $unwind: '$items' },
        {
          $group: {
            _id: '$items.product',
            quantity: { $sum: '$items.quantity' },
            revenue: {
              $sum: {
                $multiply: ['$items.quantity', '$items.price']
              }
            },
            name: { $last: '$items.name' }
          }
        },
        { $sort: { quantity: -1 } },
        { $limit: 5 },
        {
          $lookup: {
            from: 'products',
            localField: '_id',
            foreignField: '_id',
            as: 'product'
          }
        },
        {
          $project: {
            _id: 0,
            productId: '$_id',
            name: {
              $ifNull: [{ $first: '$product.name' }, '$name']
            },
            image: { $first: '$product.images' },
            quantity: 1,
            revenue: 1
          }
        }
      ])
    ])

    const totals = {
      products: totalProducts,
      users: totalUsers,
      orders: totalOrders,
      revenue: revenueByStatus
        .filter((entry) => entry._id && entry._id !== 'cancelled')
        .reduce((sum, entry) => sum + (entry.revenue || 0), 0)
    }

    const revenueStatusMap = revenueByStatus.reduce((acc, entry) => {
      const key = entry._id || 'unknown'
      acc[key] = {
        revenue: entry.revenue || 0,
        orders: entry.orders || 0
      }
      return acc
    }, {})

    const revenuePaymentMap = revenueByPaymentStatus.reduce((acc, entry) => {
      const key = entry._id || 'unknown'
      acc[key] = {
        revenue: entry.revenue || 0,
        orders: entry.orders || 0
      }
      return acc
    }, {})

    res.json({
      success: true,
      data: {
        totals,
        revenueByStatus: revenueStatusMap,
        revenueByPaymentStatus: revenuePaymentMap,
        recentOrders: recentOrders.map((order) => ({
          id: order._id,
          orderNumber: order.orderNumber,
          total: order.total,
          status: order.status,
          paymentStatus: order.paymentStatus,
          createdAt: order.createdAt,
          customer: order.user
            ? {
                id: order.user._id,
                name: order.user.name,
                phone: order.user.phone,
                email: order.user.email
              }
            : null,
          prescription: order.prescription
            ? {
                id: order.prescription._id,
                status: order.prescription.status,
                fileUrl: order.prescription.fileUrl,
                originalName: order.prescription.originalName
              }
            : null
        })),
        topProducts: topProducts
          .filter((product) => product.productId)
          .map((product) => ({
            productId: product.productId,
            name: product.name,
            image: Array.isArray(product.image) ? product.image[0] : product.image,
            quantity: product.quantity,
            revenue: product.revenue
          }))
      }
    })
  } catch (error) {
    console.error('Admin dashboard stats error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to load admin dashboard stats'
    })
  }
})

export default router


