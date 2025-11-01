// Test setup file
// This file runs before all tests

// Mock environment variables
process.env.JWT_SECRET = 'test-jwt-secret-key'
process.env.NODE_ENV = 'development' // Set to development to get OTP in responses
process.env.MONGO_URL = 'mongodb://localhost:27017/medical-shop-test'
process.env.OTP_PROVIDER = 'mock'

// Increase Jest timeout for async operations
jest.setTimeout(10000)

