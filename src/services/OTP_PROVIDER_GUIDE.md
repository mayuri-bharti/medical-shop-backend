# OTP Provider Service Guide

## Overview

The OTP Provider Service (`otpProvider.js`) is a modular SMS service that supports multiple providers for sending OTP messages to users.

## Supported Providers

### 1. Mock/Console Provider (Default)
- **Best for**: Development and testing
- **Output**: Prints SMS to console
- **No configuration needed**

### 2. Twilio
- **Best for**: International SMS delivery
- **Requires**: Twilio account credentials

### 3. MSG91
- **Best for**: India-specific SMS delivery
- **Requires**: MSG91 API key

## Configuration

Set the `OTP_PROVIDER` environment variable in your `.env` file:

```env
# For development (console output)
OTP_PROVIDER=mock

# For production with Twilio
OTP_PROVIDER=twilio

# For production with MSG91
OTP_PROVIDER=msg91
```

## Twilio Setup

1. Create a Twilio account at https://www.twilio.com
2. Get your credentials from the dashboard
3. Add to `.env`:

```env
OTP_PROVIDER=twilio
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_FROM=+1234567890  # Your Twilio phone number
```

4. Install Twilio package (optional if using mock):
```bash
npm install twilio
```

## MSG91 Setup

1. Create an MSG91 account at https://www.msg91.com
2. Get your API key from the dashboard
3. Create a template in MSG91 (required)
4. Add to `.env`:

```env
OTP_PROVIDER=msg91
MSG91_API_KEY=your-api-key
MSG91_SENDER=MEDISP  # Your sender ID
MSG91_TEMPLATE_ID=your-template-id  # Required
```

## Usage

### Basic Usage

```javascript
const { sendOtpSms } = require('../services/otpProvider')

// Send OTP
await sendOtpSms(phone, message)
```

### With Retry Logic (Recommended for Production)

```javascript
const { sendOtpSms, retryWithBackoff } = require('../services/otpProvider')

// Send with retry logic (3 retries with exponential backoff)
await retryWithBackoff(async () => {
  return await sendOtpSms(phone, message)
}, 3, 1000)
```

## Retry Logic Details

The retry logic uses exponential backoff:
- **Initial delay**: 1000ms (1 second)
- **Exponential**: Delays double with each retry (1s, 2s, 4s)
- **Max retries**: Configurable (default: 3)

This handles temporary network issues and rate limiting gracefully.

## Response Format

```javascript
{
  success: true,
  provider: 'mock',  // or 'twilio', 'msg91'
  messageId: 'mock_1234567890'  // Provider-specific ID
}
```

## Error Handling

The service throws errors on failure. Always wrap in try-catch:

```javascript
try {
  await sendOtpSms(phone, message)
  console.log('OTP sent successfully')
} catch (error) {
  console.error('Failed to send OTP:', error.message)
  // Handle error appropriately
}
```

## Production Recommendations

1. **Use retry logic**: Implement exponential backoff for reliability
2. **Monitor delivery**: Track delivery rates and failures
3. **Fallback provider**: Have a backup SMS provider
4. **Rate limiting**: Respect provider rate limits
5. **Cost optimization**: Monitor SMS costs per provider
6. **Security**: Store credentials securely, never commit to git

## Example Integration

In `routes/auth.js`:

```javascript
const { sendOtpSms, retryWithBackoff } = require('../services/otpProvider')

router.post('/send-otp', async (req, res) => {
  try {
    const { phone } = req.body
    const otp = generateOTP()
    
    // Save OTP to database
    await saveOtpToDB(phone, otp)
    
    // Send OTP via SMS
    const smsMessage = `Your MediShop OTP is ${otp}. Valid for 5 minutes.`
    
    // In production, use retry logic
    if (process.env.NODE_ENV === 'production') {
      await retryWithBackoff(async () => {
        return await sendOtpSms(phone, smsMessage)
      }, 3, 1000)
    } else {
      await sendOtpSms(phone, smsMessage)
    }
    
    res.json({ success: true, message: 'OTP sent' })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})
```

## Testing

### Development (Mock)
```bash
# In .env
OTP_PROVIDER=mock

# Run app
npm run dev

# OTP will be printed to console
```

### Production Testing
```bash
# In .env
OTP_PROVIDER=twilio  # or msg91

# Configure credentials
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_FROM=...

# Run app
npm start

# OTP will be sent via configured provider
```

## Troubleshooting

### Twilio Errors
- **Invalid phone number**: Ensure format includes country code (+1234567890)
- **Auth failed**: Check credentials are correct
- **Rate limit**: Implement retry logic

### MSG91 Errors
- **Template not approved**: Ensure template is approved in MSG91 dashboard
- **Invalid sender ID**: Check sender ID is approved
- **API key invalid**: Verify API key in dashboard

### General Issues
- **Module not found**: Run `npm install` to install provider packages
- **Credentials missing**: Check all required env variables are set
- **Network errors**: Implement retry logic with backoff

## Security Notes

1. Never commit `.env` file to git
2. Store API keys securely (use environment variables)
3. Validate phone numbers before sending
4. Implement rate limiting on send-otp endpoint
5. Log OTP attempts for security auditing
6. Set appropriate OTP expiry times








