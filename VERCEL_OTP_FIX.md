# ✅ Vercel OTP Deployment Fix

## Problem
OTP sending was working locally but failing on Vercel due to:
1. Missing `api/index.js` serverless entry point
2. Database connection not initialized per-request in serverless environment
3. Environment variables not configured in Vercel dashboard

## Changes Made

### 1. Created `api/index.js` (Vercel Serverless Entry Point)
- ✅ Handles database connection per-request (required for serverless)
- ✅ Ensures MongoDB connection before each API call
- ✅ Proper error handling for serverless environment

### 2. Updated `index.js`
- ✅ Skip DB initialization on module load when `VERCEL` env is set
- ✅ Let `api/index.js` handle DB connection per-request in serverless

### 3. Updated `vercel.json`
- ✅ Added function timeout configuration (30 seconds)
- ✅ Proper routing configuration

## Required Environment Variables in Vercel

### **MUST SET in Vercel Dashboard:**

1. **MongoDB Connection:**
   ```
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database
   ```
   OR
   ```
   MONGO_URL=mongodb+srv://username:password@cluster.mongodb.net/database
   ```

2. **JWT Secret:**
   ```
   JWT_SECRET=your-super-secret-jwt-key-here
   ```

3. **OTP Provider Configuration:**

   **Option A: Twilio (Recommended for Production)**
   ```
   OTP_PROVIDER=twilio
   TWILIO_ACCOUNT_SID=your-twilio-account-sid
   TWILIO_AUTH_TOKEN=your-twilio-auth-token
   TWILIO_FROM=+1234567890
   ```

   **Option B: MSG91 (Indian SMS Provider)**
   ```
   OTP_PROVIDER=msg91
   MSG91_API_KEY=your-msg91-api-key
   MSG91_SENDER=MEDISP
   MSG91_TEMPLATE_ID=your-template-id
   ```

   **Option C: Mock (Development Only - NOT for Production)**
   ```
   OTP_PROVIDER=mock
   ```
   ⚠️ **Warning:** Mock provider only logs to console. OTPs won't actually be sent!

4. **CORS Configuration (Optional but Recommended):**
   ```
   FRONTEND_URL=https://your-frontend-domain.vercel.app
   FRONTEND_BASE_URL=https://your-frontend-domain.vercel.app
   ```

5. **Node Environment:**
   ```
   NODE_ENV=production
   ```

## How to Set Environment Variables in Vercel

1. Go to your Vercel project dashboard
2. Click on **Settings** → **Environment Variables**
3. Add each variable:
   - **Key:** Variable name (e.g., `MONGODB_URI`)
   - **Value:** Variable value (e.g., `mongodb+srv://...`)
   - **Environment:** Select `Production`, `Preview`, and/or `Development`
4. Click **Save**
5. **Redeploy** your application for changes to take effect

## Testing OTP on Vercel

### 1. Check Environment Variables
Verify all required variables are set in Vercel dashboard.

### 2. Test Health Endpoint
```
GET https://your-backend.vercel.app/health
```
Should return:
```json
{
  "status": "OK",
  "database": "connected",
  "timestamp": "...",
  "uptime": ...
}
```

### 3. Test OTP Endpoint
```bash
POST https://your-backend.vercel.app/api/auth/send-otp
Content-Type: application/json

{
  "phone": "9876543210"
}
```

### 4. Check Vercel Logs
- Go to Vercel Dashboard → Your Project → **Deployments** → Click on latest deployment
- Click **Functions** tab to see serverless function logs
- Look for:
  - `✅ MongoDB connected in serverless function`
  - `📱 Attempting to send OTP to...`
  - `✅ OTP sent successfully via...`

## Common Issues

### Issue 1: "Database connection not ready"
**Solution:** 
- Ensure `MONGODB_URI` is set in Vercel environment variables
- Check MongoDB Atlas Network Access allows `0.0.0.0/0` (all IPs) for Vercel

### Issue 2: "OTP_PROVIDER not configured"
**Solution:**
- Set `OTP_PROVIDER=twilio` or `OTP_PROVIDER=msg91` in Vercel
- Configure corresponding provider credentials (TWILIO_* or MSG91_*)

### Issue 3: "Failed to send SMS"
**Solution:**
- Verify Twilio/MSG91 credentials are correct
- Check Twilio account has sufficient balance
- For Twilio trial accounts, verify phone numbers first

### Issue 4: "Function timeout"
**Solution:**
- Database connection might be slow
- Check MongoDB Atlas cluster performance
- Increase timeout in `vercel.json` if needed

## File Structure

```
medical-shop-backend/
├── api/
│   └── index.js          ← Vercel serverless entry point (NEW)
├── index.js              ← Main app (updated for Vercel)
├── vercel.json           ← Vercel config (updated)
└── src/
    └── routes/
        └── auth.js       ← OTP routes (no changes needed)
```

## Next Steps

1. ✅ Set all environment variables in Vercel dashboard
2. ✅ Redeploy your backend
3. ✅ Test OTP sending from production frontend
4. ✅ Monitor Vercel function logs for errors

## Verification Checklist

- [ ] `MONGODB_URI` set in Vercel
- [ ] `JWT_SECRET` set in Vercel
- [ ] `OTP_PROVIDER` set in Vercel
- [ ] Provider credentials (Twilio/MSG91) set in Vercel
- [ ] Backend redeployed after setting env vars
- [ ] Health endpoint returns `"database": "connected"`
- [ ] OTP endpoint returns success response
- [ ] SMS actually arrives on phone (if using Twilio/MSG91)

---

**Status:** ✅ Fixed - OTP should now work on Vercel!

















