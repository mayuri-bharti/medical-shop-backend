/**
 * Example test file showing how to import and test the app
 */

const request = require('supertest')
const app = require('./index')
const { connectDB, disconnectDB } = require('./db')

// Connect to test database before tests
beforeAll(async () => {
  await connectDB(process.env.MONGO_URL || 'mongodb://localhost:27017/medical-shop-test')
})

// Close database connection after tests
afterAll(async () => {
  await disconnectDB()
})

describe('Health Check', () => {
  it('should return 200 OK', async () => {
    const response = await request(app).get('/health')
    expect(response.statusCode).toBe(200)
    expect(response.body.status).toBe('OK')
  })
})

describe('Auth Endpoints', () => {
  it('should send OTP successfully', async () => {
    const response = await request(app)
      .post('/api/auth/send-otp')
      .send({ phone: '9876543210' })
    
    expect(response.statusCode).toBe(200)
    expect(response.body.success).toBe(true)
  })
  
  it('should reject invalid phone number', async () => {
    const response = await request(app)
      .post('/api/auth/send-otp')
      .send({ phone: '123' })
    
    expect(response.statusCode).toBe(400)
    expect(response.body.success).toBe(false)
  })
})

// Export for use in other test files
module.exports = { app, request }


