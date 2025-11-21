# Google OAuth Vercel Serverless Fix

## Issue: "Missing required parameter: scope" Error

The callback URL is **CORRECT**: `https://medical-shop-backend.vercel.app/api/auth/google/callback`

## Problem Analysis

The error "Missing required parameter: scope" occurs when:
1. The callback URL is accessed directly (without going through OAuth flow)
2. Or passport is trying to re-initiate OAuth without proper parameters

## Solution Applied

1. ✅ Added validation in callback.js to check for `code` or `error` query parameters
2. ✅ If callback is accessed directly (no query params), redirect to login
3. ✅ Handle OAuth errors from Google properly

## Callback URL Verification

The callback URL **MUST** be:
```
https://medical-shop-backend.vercel.app/api/auth/google/callback
```

NOT:
- ❌ `https://medical-shop-backend.vercel.app/auth/google/callback` (old path)
- ❌ `https://medical-shop-backend.vercel.app/api/google/callback` (wrong path)

## Testing Steps

1. **Go to your frontend**: `https://medical-shop-frontend.vercel.app/login`
2. **Click "Sign in with Google"**
3. **This should redirect to**: `https://medical-shop-backend.vercel.app/api/auth/google`
4. **After Google login, redirects to**: `https://medical-shop-backend.vercel.app/api/auth/google/callback?code=...`
5. **Then redirects to**: `https://medical-shop-frontend.vercel.app/login?accessToken=...`

## If Error Persists

Check Vercel logs for:
- Callback URL being used
- Any query parameters present
- Session/storage errors

## Environment Variables Needed

Make sure these are set in Vercel:
```
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_CALLBACK_URL=https://medical-shop-backend.vercel.app/api/auth/google/callback
FRONTEND_URL=https://medical-shop-frontend.vercel.app
SESSION_SECRET=your-session-secret
MONGO_URL=your-mongodb-url
```

