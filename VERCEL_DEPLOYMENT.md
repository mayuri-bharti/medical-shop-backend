# Vercel Backend Deployment Guide

This guide explains how to deploy the Medical Shop backend to Vercel.

## 📋 Prerequisites

- GitHub account with the code pushed
- Vercel account (free tier works)
- MongoDB Atlas account (for production database)

## 🚀 Deployment Steps

### 1. Configure MongoDB Atlas

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a new cluster
3. Create a database user
4. Whitelist all IPs (0.0.0.0/0) for Vercel deployment
5. Get your connection string

### 2. Connect Project to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click "Add New Project"
3. Import your GitHub repository
4. **Set Root Directory to `backend`**
5. Configure settings:
   - **Framework Preset:** Other
   - **Root Directory:** backend
   - **Build Command:** (leave empty)
   - **Output Directory:** (leave empty)
   - **Install Command:** `npm install`

### 3. Configure Environment Variables

Add these environment variables in Vercel project settings:

```bash
# Required
MONGO_URL=mongodb+srv://username:password@cluster.mongodb.net/medical-shop
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_REFRESH_SECRET=your-refresh-secret-key-change-this-in-production

# OTP Provider
OTP_PROVIDER=twilio

# Twilio Configuration (if using Twilio)
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_PHONE_NUMBER=+1234567890

# CORS Configuration
ALLOWED_ORIGINS=https://your-frontend-domain.vercel.app

# Environment
NODE_ENV=production

# Optional
REDIS_URL=your-redis-url-if-using
```

### 4. Deploy

Click "Deploy" and wait for the build to complete.

### 5. Test Your Deployment

After deployment, test these endpoints:

1. **Health Check:** `https://your-project.vercel.app/health`
2. **Root Endpoint:** `https://your-project.vercel.app/`
3. **API Root:** `https://your-project.vercel.app/api`

## 📂 Project Structure for Vercel

```
backend/
├── api/
│   └── index.js          # Vercel serverless entry point
├── src/
│   └── index.js          # Express app
├── vercel.json           # Vercel configuration
└── package.json
```

## 🔧 Key Files

### `api/index.js`
This is the Vercel serverless function entry point that exports the Express app.

### `vercel.json`
Configuration file that tells Vercel:
- How to handle serverless functions
- How to route all requests to the API

### `src/index.js`
Main Express application with all routes and middleware.

## ⚠️ Important Notes

1. **Database Connection:** Vercel serverless functions are stateless. MongoDB connections are handled automatically by Mongoose connection pooling.

2. **Cold Starts:** First request after inactivity may be slower (cold start).

3. **Environment Variables:** Always set sensitive values in Vercel dashboard, never commit them.

4. **Time Limits:** Free tier functions have a 10-second timeout. Upgrade for longer timeouts.

5. **File Uploads:** The backend includes Multer for file uploads. Consider using Cloudinary or S3 for production instead of local storage.

## 🔍 Troubleshooting

### "Route not found" error
- Verify `vercel.json` is correct
- Check that `api/index.js` exports the app correctly
- Ensure environment variables are set

### Database connection issues
- Check MongoDB Atlas IP whitelist includes Vercel IPs
- Verify connection string is correct
- Check environment variables are set

### CORS errors
- Add your frontend URL to `ALLOWED_ORIGINS` environment variable
- Or set it in the CORS configuration in `src/index.js`

## 📚 API Endpoints

All endpoints are prefixed with `/api`:

- `GET /health` - Health check (no prefix)
- `GET /` - API info
- `POST /api/auth/send-otp` - Send OTP
- `POST /api/auth/verify-otp` - Verify OTP
- `GET /api/products` - Get all products
- `GET /api/products/:id` - Get single product
- `GET /api/cart` - Get cart (authenticated)
- `POST /api/cart/items` - Add to cart (authenticated)
- `GET /api/orders` - Get orders (authenticated)
- `POST /api/orders` - Create order (authenticated)

## 🎯 Next Steps

1. Test all endpoints after deployment
2. Configure custom domain (optional)
3. Set up monitoring and logging
4. Update frontend to use new API URL
5. Set up CI/CD for automatic deployments

