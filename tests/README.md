# Backend Tests

Tests for the Medical Shop backend API using Jest and Supertest.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Make sure MongoDB is running (for integration tests)

3. Run tests:
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm test -- --coverage
```

## Test Structure

- `setup.js` - Test setup and configuration
- `auth.test.js` - Authentication endpoint tests

## Test Coverage

Tests cover:
- OTP generation and sending
- OTP verification
- Rate limiting
- Error handling
- Token generation and refresh
- User authentication

## Environment Variables for Testing

Set in `tests/setup.js`:
- `NODE_ENV=development` - To enable OTP in responses
- `MONGO_URL=mongodb://localhost:27017/medical-shop-test` - Test database
- `JWT_SECRET=test-jwt-secret-key` - Test JWT secret
- `OTP_PROVIDER=mock` - Mock SMS provider

## Notes

- Tests use a separate test database
- OTP provider is mocked to prevent actual SMS sending
- Each test cleans up data before running









