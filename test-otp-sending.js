/**
 * OTP Sending Test Script
 * This script tests the OTP sending functionality
 * 
 * Usage: node test-otp-sending.js <phone_number>
 * Example: node test-otp-sending.js +919022896203
 */

require('dotenv').config()
const { sendOtpSms } = require('./src/services/otpProvider')

async function testOtpSending() {
  // Get phone number from command line or use default
  const phone = process.argv[2] || '+919022896203'
  
  console.log('\n' + '='.repeat(60))
  console.log('🧪 Testing OTP Sending')
  console.log('='.repeat(60))
  console.log(`📞 Phone Number: ${phone}`)
  console.log(`🔧 OTP Provider: ${process.env.OTP_PROVIDER || 'mock'}`)
  console.log('='.repeat(60) + '\n')

  try {
    // Generate test OTP
    const testOtp = Math.floor(100000 + Math.random() * 900000).toString()
    const message = `Your MediShop OTP is ${testOtp}. Valid for 5 minutes. Do not share with anyone.`
    
    console.log(`🔢 Test OTP: ${testOtp}`)
    console.log(`📝 Message: ${message}`)
    console.log('\n⏳ Sending SMS...\n')
    
    // Send OTP
    const result = await sendOtpSms(phone, message)
    
    console.log('\n' + '='.repeat(60))
    console.log('✅ SUCCESS! OTP sent successfully!')
    console.log('='.repeat(60))
    console.log(`Provider: ${result.provider}`)
    console.log(`Message ID: ${result.messageId}`)
    
    if (result.provider === 'mock') {
      console.log('\n⚠️  Note: Mock mode is active (no real SMS sent)')
      console.log('   Check the console output above for the OTP')
    } else {
      console.log('\n📱 Check your phone for the SMS!')
    }
    console.log('='.repeat(60) + '\n')
    
  } catch (error) {
    console.error('\n' + '='.repeat(60))
    console.error('❌ ERROR: Failed to send OTP')
    console.error('='.repeat(60))
    console.error(`Error: ${error.message}`)
    
    if (error.code) {
      console.error(`Error Code: ${error.code}`)
    }
    
    if (error.stack) {
      console.error('\nStack trace:')
      console.error(error.stack)
    }
    
    console.error('='.repeat(60))
    console.error('\n🔧 Troubleshooting:')
    console.error('1. Check your .env file has correct credentials')
    console.error('2. For Twilio trial: Verify the phone number first')
    console.error('   https://console.twilio.com/us1/develop/phone-numbers/manage/verified')
    console.error('3. Ensure phone number includes country code (e.g., +91...)')
    console.error('4. Check backend console for detailed error logs')
    console.error('='.repeat(60) + '\n')
    
    process.exit(1)
  }
}

// Run test
testOtpSending()





