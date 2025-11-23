# Fix: Google OAuth 2.0 Policy Compliance Error

## Error Message
```
Error 400: invalid_request
You can't sign in to this app because it doesn't comply with Google's OAuth 2.0 policy for keeping apps secure.
```

## Root Cause
This error occurs when:
1. ❌ **OAuth Consent Screen is in "Testing" mode** - User's email is not added as a test user
2. ❌ **Missing required fields** in OAuth Consent Screen
3. ❌ **App verification not completed** (if published publicly)

---

## ✅ Solution: Configure OAuth Consent Screen

### Step 1: Go to OAuth Consent Screen

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project: **health** (or your project name)
3. Navigate to: **APIs & Services** → **OAuth consent screen**

### Step 2: Complete ALL Required Fields

#### **Publishing status**
- If you see **"Testing"**, you need to either:
  - **Option A (Recommended for now)**: Add test users
  - **Option B**: Publish the app (requires verification)

#### **App Information** (Required)
- **App name**: `Health App` (or your app name)
- **User support email**: Select your email (`dev.mayuribharti@gmail.com`)
- **App logo**: (Optional but recommended)
- **App domain**: (Optional)

#### **Developer contact information** (Required)
- **Email addresses**: Add `dev.mayuribharti@gmail.com`

### Step 3: Add Test Users (If in Testing Mode)

**If your app is in "Testing" mode**, you MUST add test users:

1. Scroll down to **"Test users"** section
2. Click **"+ ADD USERS"**
3. Add these emails:
   ```
   dev.mayuribharti@gmail.com
   ```
4. Click **"ADD"**
5. Click **"SAVE AND CONTINUE"** at the bottom

⚠️ **Important**: Any user trying to sign in must be added as a test user!

### Step 4: Scopes (Usually Pre-filled)

1. Click **"SAVE AND CONTINUE"** 
2. The default scopes should include:
   - `openid`
   - `.../auth/userinfo.email`
   - `.../auth/userinfo.profile`

### Step 5: Summary

1. Review all settings
2. Click **"BACK TO DASHBOARD"** or **"SAVE"**

---

## ✅ Alternative: Publish Your App (For Public Access)

If you want ANY user to sign in (not just test users):

1. In OAuth Consent Screen, click **"PUBLISH APP"**
2. Warning: You may need to complete **App Verification** if you request sensitive scopes
3. For basic profile/email scopes, publishing usually works immediately

---

## ✅ Quick Fix Checklist

- [ ] Go to **APIs & Services** → **OAuth consent screen**
- [ ] Fill in **App name** (required)
- [ ] Select **User support email** (required)
- [ ] Add **Developer contact email** (required)
- [ ] Click through all steps and **SAVE**
- [ ] If in Testing mode: **Add test users** (add `dev.mayuribharti@gmail.com`)
- [ ] Wait 5-10 minutes for changes to propagate
- [ ] Try logging in again

---

## ⚠️ Common Issues

### Issue 1: "Testing" Mode Without Test Users
**Error**: User can't sign in  
**Fix**: Add the user's email to "Test users" list

### Issue 2: Missing Required Fields
**Error**: Cannot save OAuth consent screen  
**Fix**: Fill in ALL fields marked with red asterisk (*)

### Issue 3: Changes Not Taking Effect
**Error**: Still seeing the same error  
**Fix**: 
- Wait 5-10 minutes
- Clear browser cache
- Try incognito/private window

---

## 📋 Current Status Check

After configuring, verify:

1. **Publishing status**: Should show "Testing" or "In production"
2. **Test users**: If Testing mode, should list `dev.mayuribharti@gmail.com`
3. **App information**: All required fields filled

---

## 🎯 Expected Result

After fixing:
- User can click "Sign in with Google"
- Google shows consent screen (if first time)
- User is successfully authenticated
- Redirects back to your app

---

## 📚 Reference

- [Google OAuth Consent Screen Docs](https://support.google.com/cloud/answer/10311615)
- [Testing vs Published Apps](https://developers.google.com/identity/protocols/oauth2/policies#testing)

