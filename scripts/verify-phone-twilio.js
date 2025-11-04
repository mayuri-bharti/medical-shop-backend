/**
 * Verify Phone Number in Twilio (for Trial Accounts)
 * 
 * NOTE: This script helps you understand the process.
 * For Twilio trial accounts, you must verify phone numbers manually
 * in the Twilio Console.
 * 
 * Visit: https://console.twilio.com/us1/develop/phone-numbers/manage/verified
 */

import dotenv from 'dotenv'
dotenv.config()

const phoneNumber = process.argv[2] || '9890539426'

console.log('\n' + '='.repeat(60))
console.log('📱 Twilio Phone Number Verification Guide')
console.log('='.repeat(60) + '\n')

console.log(`📞 Phone Number to Verify: +91${phoneNumber}`)
console.log('\n🔍 For Twilio Trial Accounts:\n')

console.log('Step 1: Go to Twilio Console')
console.log('   👉 https://console.twilio.com/us1/develop/phone-numbers/manage/verified')
console.log('\nStep 2: Click "Add a new number" or "+" button')
console.log('\nStep 3: Select your country (India)')
console.log(`\nStep 4: Enter phone number: +91${phoneNumber}`)
console.log('\nStep 5: Click "Call Me" or "Text Me" to receive verification code')
console.log('\nStep 6: Enter the verification code you receive')
console.log('\nStep 7: Click "Verify"')
console.log('\n✅ Once verified, you can send SMS to this number\n')

console.log('='.repeat(60))
console.log('💡 Alternative: Use Mock Mode for Development')
console.log('='.repeat(60))
console.log('\nFor local development, you can use mock mode:')
console.log('   Set OTP_PROVIDER=mock in your .env file')
console.log('   This will print OTP to console instead of sending SMS\n')

console.log('Current Configuration:')
console.log(`   OTP_PROVIDER: ${process.env.OTP_PROVIDER || 'not set'}`)
console.log(`   TWILIO_ACCOUNT_SID: ${process.env.TWILIO_ACCOUNT_SID ? 'Set' : 'NOT SET'}`)
console.log(`   TWILIO_FROM: ${process.env.TWILIO_FROM || 'NOT SET'}\n`)

if (process.env.OTP_PROVIDER === 'twilio') {
  console.log('⚠️  You are using Twilio provider.')
  console.log('   Make sure to verify your phone number in Twilio Console before testing.\n')
} else {
  console.log('ℹ️  You are using mock mode.')
  console.log('   OTP will be printed to console, no actual SMS will be sent.\n')
}

process.exit(0)

