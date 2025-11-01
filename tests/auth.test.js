const request = require('supertest')
const mongoose = require('mongoose')
const app = require('../src/index')
const User = require('../models/User')
const Otp = require('../models/Otp')

// Mock the OTP provider
jest.mock('../src/services/otpProvider', () => ({
  sendOtpSms: jest.fn()
}))

const { sendOtpSms } = require('../src/services/otpProvider')

describe('Auth API Tests', () => {
  beforeAll(async () => {
    // Connect to test database
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URL)
    }
  })

  afterAll(async () => {
    // Cleanup
    await mongoose.connection.close()
  })

  beforeEach(async () => {
    // Clear collections before each test
    await User.deleteMany({})
    await Otp.deleteMany({})
    
    // Reset mocks
    jest.clearAllMocks()
    
    // Setup default mock for OTP provider
    sendOtpSms.mockResolvedValue({
      success: true,
      provider: 'mock',
      messageId: 'mock-message-id'
    })
  })

  describe('POST /api/auth/send-otp', () => {
    it('should send OTP successfully for valid phone number', async () => {
      const response = await request(app)
        .post('/api/auth/send-otp')
        .send({ phone: '9876543210' })
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.message).toBeDefined()
      expect(sendOtpSms).toHaveBeenCalledTimes(1)
    })

    it('should return 400 for invalid phone number', async () => {
      const response = await request(app)
        .post('/api/auth/send-otp')
        .send({ phone: '123' })
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(sendOtpSms).not.toHaveBeenCalled()
    })

    it('should return 400 for missing phone number', async () => {
      const response = await request(app)
        .post('/api/auth/send-otp')
        .send({})
        .expect(400)

      expect(response.body.success).toBe(false)
    })

    it('should handle OTP provider failure gracefully', async () => {
      sendOtpSms.mockRejectedValueOnce(new Error('SMS provider error'))

      const response = await request(app)
        .post('/api/auth/send-otp')
        .send({ phone: '9876543210' })
        .expect(500)

      expect(response.body.success).toBe(false)
    })

    it('should enforce rate limiting', async () => {
      // Send multiple OTPs in quick succession
      for (let i = 0; i < 6; i++) {
        await request(app)
          .post('/api/auth/send-otp')
          .send({ phone: '9876543210' })
      }

      // The last request should be rate limited
      const response = await request(app)
        .post('/api/auth/send-otp')
        .send({ phone: '9876543210' })
        .expect(429)

      expect(response.body.message).toContain('Too many requests')
    })
  })

  describe('POST /api/auth/verify-otp', () => {
    let testPhone = '9876543210'
    let testOtp = ''

    beforeEach(async () => {
      // First, send an OTP to get the actual OTP value
      const sendResponse = await request(app)
        .post('/api/auth/send-otp')
        .send({ phone: testPhone })

      // Extract OTP from the response (in test, we can see the plain OTP)
      // In production, OTP would come from SMS
      const otpDoc = await Otp.findOne({ phone: testPhone, isUsed: false })
      
      // We'll need to get the plain OTP by checking the service response
      // For now, let's use the pattern to extract it
      testOtp = sendResponse.body.data?.otp || '123456' // Fallback for testing
    })

    it('should verify OTP successfully', async () => {
      // Get the actual OTP that was stored
      const otpDoc = await Otp.findOne({ phone: testPhone, isUsed: false })
      
      // Manually extract OTP by checking bcrypt
      // For testing purposes, we'll store the plain OTP temporarily
      
      // First, let's get the OTP from the send response
      const sendResponse = await request(app)
        .post('/api/auth/send-otp')
        .send({ phone: testPhone })

      const otp = sendResponse.body.data?.otp

      const response = await request(app)
        .post('/api/auth/verify-otp')
        .send({ phone: testPhone, otp })
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.accessToken).toBeDefined()
      expect(response.body.data.user).toBeDefined()
      expect(response.body.data.user.phone).toBe(testPhone)
    })

    it('should return 400 for invalid OTP', async () => {
      const response = await request(app)
        .post('/api/auth/verify-otp')
        .send({ phone: testPhone, otp: '000000' })
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.message).toContain('Invalid OTP')
    })

    it('should return 410 for expired OTP', async () => {
      // Create an expired OTP manually
      const expiredOtp = await Otp.create({
        phone: testPhone,
        otpHash: 'expired-hash',
        purpose: 'LOGIN',
        expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
        attempts: 0,
        isUsed: false,
        sendCount: 1
      })

      const response = await request(app)
        .post('/api/auth/verify-otp')
        .send({ phone: testPhone, otp: '123456' })
        .expect(410)

      expect(response.body.success).toBe(false)
      expect(response.body.message).toContain('expired')
    })

    it('should return 400 for missing phone or OTP', async () => {
      const response = await request(app)
        .post('/api/auth/verify-otp')
        .send({ phone: testPhone })
        .expect(400)

      expect(response.body.success).toBe(false)
    })

    it('should lock account after 5 failed attempts', async () => {
      // Attempt wrong OTP 5 times
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/auth/verify-otp')
          .send({ phone: testPhone, otp: '000000' })
      }

      // 6th attempt should be locked
      const response = await request(app)
        .post('/api/auth/verify-otp')
        .send({ phone: testPhone, otp: '000000' })
        .expect(403)

      expect(response.body.success).toBe(false)
      expect(response.body.message).toContain('Too many failed attempts')
    })

    it('should create new user if phone not registered', async () => {
      const newPhone = '9999999999'
      
      // Send OTP
      const sendResponse = await request(app)
        .post('/api/auth/send-otp')
        .send({ phone: newPhone })

      const otp = sendResponse.body.data?.otp

      // Verify OTP
      const verifyResponse = await request(app)
        .post('/api/auth/verify-otp')
        .send({ phone: newPhone, otp })
        .expect(200)

      // Check user was created
      const user = await User.findOne({ phone: newPhone })
      expect(user).toBeDefined()
      expect(user.phone).toBe(newPhone)
      expect(user.role).toBe('USER')
    })
  })

  describe('POST /api/auth/refresh', () => {
    it('should refresh access token with valid refresh token', async () => {
      // First, get tokens by verifying OTP
      const testPhone = '9876543210'
      
      const sendResponse = await request(app)
        .post('/api/auth/send-otp')
        .send({ phone: testPhone })

      const otp = sendResponse.body.data?.otp

      const verifyResponse = await request(app)
        .post('/api/auth/verify-otp')
        .send({ phone: testPhone, otp })
        .expect(200)

      const refreshToken = verifyResponse.body.data.refreshToken

      // Use refresh token to get new access token
      const refreshResponse = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(200)

      expect(refreshResponse.body.success).toBe(true)
      expect(refreshResponse.body.data.accessToken).toBeDefined()
    })

    it('should return 401 for invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid-token' })
        .expect(401)

      expect(response.body.success).toBe(false)
    })
  })

  describe('GET /api/auth/me', () => {
    it('should return user info with valid token', async () => {
      // Get tokens
      const testPhone = '9876543210'
      
      const sendResponse = await request(app)
        .post('/api/auth/send-otp')
        .send({ phone: testPhone })

      const otp = sendResponse.body.data?.otp

      const verifyResponse = await request(app)
        .post('/api/auth/verify-otp')
        .send({ phone: testPhone, otp })

      const accessToken = verifyResponse.body.data.accessToken

      // Get user info
      const meResponse = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)

      expect(meResponse.body.success).toBe(true)
      expect(meResponse.body.data.user).toBeDefined()
      expect(meResponse.body.data.user.phone).toBe(testPhone)
    })

    it('should return 401 without token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .expect(401)

      expect(response.body.success).toBe(false)
    })
  })

  describe('POST /api/auth/logout', () => {
    it('should logout successfully', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .expect(200)

      expect(response.body.success).toBe(true)
    })
  })
})

