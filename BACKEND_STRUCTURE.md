# Backend Express App Structure

## 📁 File Structure

```
backend/
├── src/
│   ├── index.js           # Express app entry point
│   ├── db.js              # MongoDB connection helper
│   ├── middleware/
│   │   └── auth.js        # JWT authentication middleware
│   ├── routes/
│   │   └── auth.js        # Authentication routes
│   └── test-example.js    # Example test file
├── models/
│   ├── User.js            # User model
│   ├── Otp.js             # OTP model
│   ├── Product.js         # Product model
│   └── Order.js           # Order model
├── scripts/
│   ├── seed.js            # Database seeding script
│   └── fix-indexes.js     # Database index fixer
├── .env                   # Environment variables (not in git)
├── env.example            # Environment variables template
├── package.json           # Dependencies and scripts
└── BACKEND_STRUCTURE.md   # This file
```

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
```bash
cp env.example .env
# Edit .env with your configuration
```

### 3. Seed Database (Optional)
```bash
npm run seed
```

### 4. Start Development Server
```bash
npm run dev
```

### 5. Start Production Server
```bash
npm start
```

## 🔧 Environment Variables

### Required
- `MONGO_URL` - MongoDB connection string
- `JWT_SECRET` - Secret key for JWT tokens

### Optional
- `PORT` - Server port (default: 5000)
- `NODE_ENV` - Environment (development/production/test)
- `REDIS_URL` - Redis connection string
- `ALLOWED_ORIGINS` - Comma-separated list of allowed origins
- `OTP_PROVIDER` - OTP provider (console/twilio)

## 📋 API Endpoints

### Authentication

#### POST /api/auth/send-otp
Send OTP to phone number
```json
{
  "phone": "9876543210"
}
```

#### POST /api/auth/verify-otp
Verify OTP and login
```json
{
  "phone": "9876543210",
  "otp": "123456"
}
```

#### GET /api/auth/me
Get current user profile (requires auth)

#### POST /api/auth/logout
Logout user (requires auth)

### Health Check

#### GET /health
Server health status

## 🔐 Authentication Flow

1. **Send OTP**: User sends POST request with phone number
2. **OTP Generation**: Server generates 6-digit OTP and hashes it
3. **OTP Storage**: Hashed OTP stored in database with 5-minute expiry
4. **OTP Delivery**: OTP sent to user (via SMS in production)
5. **Verify OTP**: User submits OTP for verification
6. **User Creation**: New user created if doesn't exist
7. **JWT Token**: User receives JWT token for authentication
8. **Protected Routes**: Use JWT token in Authorization header

## 🛡️ Security Features

- **Helmet**: Security headers
- **CORS**: Origin allowlist
- **Rate Limiting**: Prevents brute force attacks
- **OTP Hashing**: bcrypt for secure storage
- **JWT**: Stateless authentication
- **Input Validation**: express-validator

## 📝 Code Features

### Modular Architecture
- Separation of concerns
- Exportable modules for testing
- Clean code structure

### Error Handling
- Global error handler
- Detailed error messages in development
- Secure error messages in production

### Logging
- Morgan for HTTP request logging
- Console logging for events
- Error logging

### Database
- MongoDB with Mongoose
- Connection pooling
- Graceful shutdown
- Index optimization

### Redis (Optional)
- Caching layer
- Session storage
- Rate limiting

## 🧪 Testing

```javascript
const request = require('supertest')
const app = require('./index')

// Test example
const response = await request(app)
  .post('/api/auth/send-otp')
  .send({ phone: '9876543210' })

expect(response.statusCode).toBe(200)
```

## 📊 Middleware Stack

1. **helmet** - Security headers
2. **cors** - Cross-origin requests
3. **rate limit** - Request limiting
4. **morgan** - Request logging
5. **express.json** - Body parsing
6. **Routes** - Application routes
7. **Error handler** - Global error handling

## 🔄 Request Flow

```
Request → CORS → Helmet → Rate Limit → Morgan → Body Parser → Routes → Response
                                                                         ↓
                                                                Error Handler
```

## 📦 Dependencies

### Core
- express: Web framework
- mongoose: MongoDB ODM
- jsonwebtoken: JWT authentication
- bcryptjs: Password/OTP hashing

### Security
- helmet: Security headers
- cors: Cross-origin handling
- express-rate-limit: Rate limiting

### Utilities
- express-validator: Input validation
- morgan: HTTP logging
- redis: Caching (optional)
- dotenv: Environment variables

### Development
- nodemon: Auto-reload
- jest: Testing framework
- supertest: HTTP testing

## 🎯 Best Practices

1. **Environment Variables**: Never commit .env file
2. **Error Handling**: Always handle errors gracefully
3. **Validation**: Validate all inputs
4. **Logging**: Log important events
5. **Security**: Use HTTPS in production
6. **Testing**: Write tests for critical paths
7. **Documentation**: Keep documentation updated
8. **Code Style**: Follow consistent code style
9. **Git**: Use meaningful commit messages
10. **Performance**: Optimize database queries

## 🐛 Troubleshooting

### MongoDB Connection Error
- Check MONGO_URL is correct
- Verify MongoDB is running
- Check network connectivity

### OTP Not Received
- Check OTP_PROVIDER configuration
- Verify SMS service credentials
- Check logs for errors

### JWT Token Error
- Verify JWT_SECRET is set
- Check token expiration
- Ensure token is in Authorization header

### CORS Error
- Add origin to ALLOWED_ORIGINS
- Check CORS configuration
- Verify frontend URL

## 📚 Additional Resources

- [Express.js Documentation](https://expressjs.com/)
- [Mongoose Documentation](https://mongoosejs.com/)
- [JWT Documentation](https://jwt.io/)
- [Bcrypt Documentation](https://www.npmjs.com/package/bcryptjs)


