/**
 * OTP Service Provider
 * Supports multiple SMS providers: Twilio, MSG91, and Mock
 * Configure via OTP_PROVIDER environment variable
 */

/**
 * Send OTP via configured SMS provider
 * @param {string} phone - Phone number (should include country code)
 * @param {string} message - SMS message content
 * @returns {Promise<{success: boolean, provider: string, messageId?: string}>}
 * @throws {Error} If sending fails
 */
const sendOtpSms = async (phone, message) => {
  const provider = process.env.OTP_PROVIDER || 'mock'

  try {
    switch (provider.toLowerCase()) {
      case 'twilio':
        return await sendViaTwilio(phone, message)
      
      case 'msg91':
        return await sendViaMsg91(phone, message)
      
      case 'mock':
      case 'console':
      default:
        return await sendViaMock(phone, message)
    }
  } catch (error) {
    console.error(`❌ OTP send failed via ${provider}:`, error.message)
    throw error
  }
}

/**
 * Send OTP via Twilio
 * @param {string} phone - Phone number
 * @param {string} message - SMS message
 * @returns {Promise<{success: boolean, provider: string, messageId: string}>}
 */
const sendViaTwilio = async (phone, message) => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_FROM || process.env.TWILIO_PHONE_NUMBER

  console.log('🔧 Twilio Configuration Check:', {
    accountSid: accountSid ? `${accountSid.substring(0, 10)}...` : 'MISSING',
    authToken: authToken ? `${authToken.substring(0, 8)}...` : 'MISSING',
    from: from || 'MISSING'
  })

  if (!accountSid || !authToken || !from) {
    throw new Error('Twilio credentials not configured. Check TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM environment variables.')
  }

  // Dynamically require Twilio to avoid errors if not installed
  let twilio
  try {
    twilio = require('twilio')
  } catch (err) {
    throw new Error('Twilio package not installed. Run: npm install twilio')
  }

  const client = twilio(accountSid, authToken)

  try {
    // Ensure phone number has country code (add +91 for Indian numbers if missing)
    let formattedPhone = phone
    if (!phone.startsWith('+')) {
      // If phone starts with 91, add +
      if (phone.startsWith('91') && phone.length === 12) {
        formattedPhone = '+' + phone
      }
      // If it's a 10-digit Indian number, add +91
      else if (phone.length === 10 && /^[6-9]\d{9}$/.test(phone)) {
        formattedPhone = '+91' + phone
      }
      // Otherwise, assume it needs +
      else {
        formattedPhone = '+' + phone
      }
    }

    console.log(`📤 Sending SMS via Twilio...`, {
      originalPhone: phone,
      formattedPhone: formattedPhone,
      from: from,
      messageLength: message.length
    })

    const result = await client.messages.create({
      body: message,
      from: from,
      to: formattedPhone
    })

    console.log(`✅ OTP sent via Twilio successfully!`, {
      sid: result.sid,
      status: result.status,
      to: phone
    })

    return {
      success: true,
      provider: 'twilio',
      messageId: result.sid
    }
  } catch (twilioError) {
    // Enhanced error logging for Twilio-specific errors
    console.error('❌ Twilio API Error:', {
      code: twilioError.code,
      message: twilioError.message,
      status: twilioError.status,
      moreInfo: twilioError.moreInfo,
      details: twilioError.details
    })

    // Provide user-friendly error messages
    let userMessage = twilioError.message
    
    if (twilioError.code === 21211) {
      userMessage = 'Invalid phone number format. Please include country code (e.g., +919876543210)'
    } else if (twilioError.code === 21608) {
      userMessage = 'This phone number is not verified. For Twilio trial accounts, verify your number first at https://console.twilio.com/us1/develop/phone-numbers/manage/verified'
    } else if (twilioError.code === 20003) {
      userMessage = 'Authentication failed. Please check your Twilio credentials in .env file'
    } else if (twilioError.code === 21606) {
      userMessage = 'The phone number cannot receive SMS messages'
    }

    throw new Error(userMessage)
  }
}

/**
 * Send OTP via MSG91
 * @param {string} phone - Phone number
 * @param {string} message - SMS message
 * @returns {Promise<{success: boolean, provider: string, messageId: string}>}
 */
const sendViaMsg91 = async (phone, message) => {
  const apiKey = process.env.MSG91_API_KEY
  const sender = process.env.MSG91_SENDER || 'MEDISP'

  if (!apiKey) {
    throw new Error('MSG91 credentials not configured. Check MSG91_API_KEY environment variable.')
  }

  // MSG91 API endpoint
  const url = 'https://control.msg91.com/api/v5/flow'
  
  // For production: Implement retry logic with exponential backoff
  // Example: retry 3 times with delays of 1s, 2s, 4s
  // try {
  //   const response = await fetch(url, { ... })
  // } catch (error) {
  //   // Implement retry logic here
  //   // await sleep(delay)
  //   // retry...
  // }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'authkey': apiKey
    },
    body: JSON.stringify({
      template_id: process.env.MSG91_TEMPLATE_ID || 'your-template-id',
      sender: sender,
      short_url: '0',
      mobiles: phone,
      otp: message.match(/\d{6}/)?.[0] || '' // Extract 6-digit OTP from message
    })
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`MSG91 API error: ${error}`)
  }

  const result = await response.json()
  
  // MSG91 returns success as "1" or "0"
  const success = result.type === 'success' || result.msg?.includes('sent')

  if (!success) {
    throw new Error(`MSG91 send failed: ${JSON.stringify(result)}`)
  }

  console.log(`✅ OTP sent via MSG91 to ${phone}`)

  return {
    success: true,
    provider: 'msg91',
    messageId: result.request_id || 'unknown'
  }
}

/**
 * Mock/Console SMS provider (for development)
 * @param {string} phone - Phone number
 * @param {string} message - SMS message
 * @returns {Promise<{success: boolean, provider: string, messageId: string}>}
 */
const sendViaMock = async (phone, message) => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 500))

  // In development, print to console
  console.log('\n' + '='.repeat(60))
  console.log('📱 MOCK SMS (Development Mode)')
  console.log('='.repeat(60))
  console.log(`To: ${phone}`)
  console.log(`Message: ${message}`)
  console.log('='.repeat(60) + '\n')

  return {
    success: true,
    provider: 'mock',
    messageId: `mock_${Date.now()}`
  }
}

/**
 * Retry helper function with exponential backoff
 * @param {Function} fn - Function to retry
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} initialDelay - Initial delay in milliseconds
 * @returns {Promise<any>}
 * 
 * Usage example:
 * const sendWithRetry = () => sendOtpSms(phone, message)
 * await retryWithBackoff(sendWithRetry, 3, 1000)
 */
const retryWithBackoff = async (fn, maxRetries = 3, initialDelay = 1000) => {
  let lastError
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      
      if (attempt < maxRetries) {
        const delay = initialDelay * Math.pow(2, attempt) // Exponential backoff
        console.warn(`⚠️  Attempt ${attempt + 1} failed, retrying in ${delay}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }
  
  throw lastError
}

module.exports = {
  sendOtpSms,
  retryWithBackoff
}

