# Vercel 500 Error Fix - Google OAuth

## Problem
Serverless function crashing with 500 error on Vercel deployment when accessing `/auth/google`.

## Root Causes Identified

1. **Passport.js initialization errors** - GoogleStrategy initialization failing silently
2. **Missing error handling** - Module imports crashing without proper error boundaries
3. **Environment variable issues** - Missing or invalid Google OAuth credentials
4. **Callback URL configuration** - Incorrect callback URL for Vercel

## Fixes Applied

### 1. Enhanced Error Handling in `config/passport.js`
- Added try-catch around GoogleStrategy initialization
- Reduced logging noise in serverless environment
- Added error handling for callback URL generation
- Made passport configuration more resilient

### 2. Improved `api/index.js`
- Better error handling for database connections
- Added middleware to ensure DB connection before routes
- Reduced console logs for production

### 3. Route Registration
- Ensured Google Auth routes are registered before 404 handler
- Added logging for route registration

## Environment Variables Required on Vercel

Make sure these are set in Vercel dashboard:

```
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_CALLBACK_URL=https://your-backend.vercel.app/auth/google/callback
FRONTEND_URL=https://your-frontend.vercel.app
MONGO_URL=your-mongodb-connection-string
SESSION_SECRET=your-session-secret
JWT_SECRET=your-jwt-secret
```

## Testing

1. **Check Vercel Logs:**
   - Go to Vercel Dashboard → Your Project → Logs
   - Look for any error messages during function invocation

2. **Test Endpoints:**
   ```
   GET https://your-backend.vercel.app/
   GET https://your-backend.vercel.app/auth/google
   GET https://your-backend.vercel.app/health
   ```

3. **Common Issues:**
   - Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET → Function will work but Google login disabled
   - Invalid callback URL → Google OAuth will fail
   - Missing MONGO_URL → Database operations will fail
   - Invalid SESSION_SECRET → Session management will fail

## Next Steps

1. Deploy the fixed code to Vercel
2. Check Vercel deployment logs for any errors
3. Verify environment variables are set correctly
4. Test the `/auth/google` endpoint
5. Check Google Cloud Console for correct callback URL configuration

## Notes

- The app will now continue working even if Google OAuth is not configured
- Error messages are logged to Vercel logs (check dashboard)
- Reduced console logging for better performance on Vercel

