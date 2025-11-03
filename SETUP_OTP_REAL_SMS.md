# 🚀 Setup Real SMS OTP - Step by Step Guide

## 📋 Current Status
Your OTP is set to **MOCK mode** which only prints OTP to console and doesn't send real SMS.

## ⚡ Quick Fix Guide

### Step 1: Choose Your SMS Provider

| Provider | Best For | Cost | Setup Time |
|----------|----------|------|------------|
| **Twilio** | International, Testing | Free trial ($15 credit) | 5 minutes |
| **MSG91** | India | ~₹0.30/SMS | 10 minutes |
| **Mock** | Local development | Free | 0 (current) |

---

## 🔧 Option A: Setup Twilio (Recommended)

### 1. Sign Up for Twilio
- Go to: https://www.twilio.com/try-twilio
- Create a free account
- You'll get **$15 credit** (enough for ~500 SMS)

### 2. Get Your Credentials
1. Go to https://console.twilio.com
2. Copy these three values:
   - **Account SID** (starts with "AC...")
   - **Auth Token** (click to reveal)
   - **Phone Number** (from the "Phone Numbers" section, format: +1234567890)

### 3. Update Your `.env` File
Open `backend/.env` and update these lines:

```env
OTP_PROVIDER=twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_FROM=+1234567890
```

### 4. Verify Test Phone Numbers (For Trial Account)
**Important:** Twilio trial accounts can only send to verified phone numbers!

1. Go to: https://console.twilio.com/us1/develop/phone-numbers/manage/verified
2. Click "Add a new number"
3. Enter your phone number (e.g., +919022896203)
4. Verify it via SMS or call

### 5. Install Twilio Package (if not already installed)
```bash
cd backend
npm install twilio
```

### 6. Restart Backend
```bash
npm start
```

### 7. Test It! 🎉
- Open your app login page
- Enter your **verified phone number**
- Click "Send OTP"
- You should receive a real SMS! 📱

---

## 🔧 Option B: Setup MSG91 (Better for India)

### 1. Sign Up for MSG91
- Go to: https://msg91.com/
- Create an account
- Add credits (minimum ₹100, enough for ~300 SMS)

### 2. Get Your API Key
1. Login to MSG91 dashboard
2. Go to: Settings → API Keys
3. Copy your API key

### 3. Create SMS Template (Optional but recommended)
1. Go to: Templates → Create Template
2. Template content: `Your MediShop OTP is ##OTP##. Valid for 5 minutes.`
3. Submit for approval (takes 1-2 hours)
4. Copy the Template ID

### 4. Update Your `.env` File
Open `backend/.env` and update:

```env
OTP_PROVIDER=msg91
MSG91_API_KEY=your_api_key_here
MSG91_SENDER=MEDSHP
MSG91_TEMPLATE_ID=your_template_id
```

### 5. Restart Backend
```bash
npm start
```

### 6. Test It! 🎉
- Open your app login page
- Enter any Indian phone number (+91...)
- Click "Send OTP"
- You should receive a real SMS! 📱

---

## 🔧 Option C: Keep Mock Mode (Testing Only)

If you want to continue testing without real SMS:

### Update `.env`:
```env
OTP_PROVIDER=mock
```

### How to Get OTP:
When you request OTP, check your **backend terminal/console**. You'll see:

```
============================================================
📱 MOCK SMS (Development Mode)
============================================================
To: +919022896203
Message: Your MediShop OTP is 123456. Valid for 5 minutes.
============================================================
```

Copy the OTP from there and use it to login.

---

## 🐛 Troubleshooting

### Issue: "Twilio credentials not configured"
**Solution:** Make sure all three Twilio variables are filled in `.env`:
- TWILIO_ACCOUNT_SID
- TWILIO_AUTH_TOKEN
- TWILIO_FROM

### Issue: "Unverified number" (Twilio trial)
**Solution:** Verify the phone number in Twilio console first:
https://console.twilio.com/us1/develop/phone-numbers/manage/verified

### Issue: "MSG91 API error"
**Solution:** 
1. Check your MSG91 credit balance
2. Verify your API key is correct
3. Make sure template is approved (if using template)

### Issue: Still not receiving SMS
**Solution:**
1. Check backend console for error messages
2. Verify you restarted the backend after changing `.env`
3. Check phone number format (include country code: +91...)
4. For Twilio trial: verify the recipient's number first

---

## 📊 Cost Comparison

### Twilio
- Trial: FREE ($15 credit = ~500 SMS)
- After trial: $0.0079/SMS (India)
- Best for: Testing, International

### MSG91
- Minimum: ₹100 (~300 SMS)
- Cost: ~₹0.30/SMS
- Best for: Production in India

### Mock Mode
- FREE
- Best for: Local development/testing

---

## ✅ Checklist

After setup, verify:
- [ ] `.env` file has correct OTP_PROVIDER value
- [ ] All credentials are filled in (no placeholders)
- [ ] Backend server restarted
- [ ] Phone number format is correct (+country_code...)
- [ ] For Twilio trial: recipient number is verified
- [ ] You can see success message in backend console
- [ ] SMS is received on phone

---

## 🆘 Need Help?

If you're still having issues:
1. Check the backend console for error messages
2. Verify your credentials are correct
3. Test with the provider's dashboard first
4. Make sure you have credits/balance in your account

---

## 🔐 Security Notes

**NEVER commit your `.env` file to Git!**

Your `.env` file contains sensitive credentials. Make sure:
- `.env` is in your `.gitignore` file
- Share only `.env.example` or `.env.template` files
- Use different credentials for production vs development



