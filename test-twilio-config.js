/**
 * Twilio Configuration Test Script
 * Run this to verify your Twilio setup is correct
 * 
 * Usage: node test-twilio-config.js
 */

import dotenv from 'dotenv'
dotenv.config()

async function checkTwilioConfig() {
  console.log('\n🔍 Checking Twilio Configuration...\n')

  // Check environment variables
  const config = {
    OTP_PROVIDER: process.env.OTP_PROVIDER,
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
    TWILIO_FROM: process.env.TWILIO_FROM
  }

  let hasErrors = false

  // Check OTP Provider
  console.log('1️⃣  OTP_PROVIDER:')
  if (config.OTP_PROVIDER === 'twilio') {
    console.log('   ✅ Set to "twilio"')
  } else {
    console.log(`   ❌ Set to "${config.OTP_PROVIDER}" (should be "twilio")`)
    hasErrors = true
  }

  // Check Account SID
  console.log('\n2️⃣  TWILIO_ACCOUNT_SID:')
  if (!config.TWILIO_ACCOUNT_SID) {
    console.log('   ❌ Not set')
    hasErrors = true
  } else if (!config.TWILIO_ACCOUNT_SID.startsWith('AC')) {
    console.log(`   ❌ Invalid format (should start with "AC")`)
    console.log(`   Current value: ${config.TWILIO_ACCOUNT_SID.substring(0, 10)}...`)
    hasErrors = true
  } else if (config.TWILIO_ACCOUNT_SID.length !== 34) {
    console.log(`   ⚠️  Length is ${config.TWILIO_ACCOUNT_SID.length} (should be 34)`)
    console.log(`   Value: ${config.TWILIO_ACCOUNT_SID.substring(0, 10)}...`)
  } else {
    console.log(`   ✅ Format looks correct: ${config.TWILIO_ACCOUNT_SID.substring(0, 10)}...`)
  }

  // Check Auth Token
  console.log('\n3️⃣  TWILIO_AUTH_TOKEN:')
  if (!config.TWILIO_AUTH_TOKEN) {
    console.log('   ❌ Not set')
    hasErrors = true
  } else if (config.TWILIO_AUTH_TOKEN.length !== 32) {
    console.log(`   ⚠️  Length is ${config.TWILIO_AUTH_TOKEN.length} (should be 32)`)
    console.log(`   Value: ${config.TWILIO_AUTH_TOKEN.substring(0, 8)}...`)
  } else {
    console.log(`   ✅ Format looks correct: ${config.TWILIO_AUTH_TOKEN.substring(0, 8)}...`)
  }

  // Check Phone Number
  console.log('\n4️⃣  TWILIO_FROM:')
  if (!config.TWILIO_FROM) {
    console.log('   ❌ Not set')
    hasErrors = true
  } else if (!config.TWILIO_FROM.startsWith('+')) {
    console.log(`   ❌ Missing country code (should start with "+")`)
    console.log(`   Current value: ${config.TWILIO_FROM}`)
    hasErrors = true
  } else {
    console.log(`   ✅ Format looks correct: ${config.TWILIO_FROM}`)
  }

  // Test Twilio package
  console.log('\n5️⃣  Twilio Package:')
  try {
    const twilioModule = await import('twilio')
    const twilio = twilioModule.default || twilioModule
    console.log('   ✅ Twilio package installed')
    
    // Try to create client
    if (config.TWILIO_ACCOUNT_SID && config.TWILIO_AUTH_TOKEN) {
      try {
        const client = twilio(config.TWILIO_ACCOUNT_SID, config.TWILIO_AUTH_TOKEN)
        console.log('   ✅ Twilio client created successfully')
      } catch (err) {
        console.log(`   ❌ Error creating Twilio client: ${err.message}`)
        hasErrors = true
      }
    }
  } catch (err) {
    console.log('   ❌ Twilio package not installed')
    console.log('   Run: npm install twilio')
    hasErrors = true
  }

  // Summary
  console.log('\n' + '='.repeat(60))
  if (hasErrors) {
    console.log('❌ Configuration has errors. Fix the issues above.')
    console.log('\n📖 Need help? Check backend/SETUP_OTP_REAL_SMS.md')
    process.exit(1)
  } else {
    console.log('✅ Twilio configuration looks good!')
    console.log('\n📱 Next steps:')
    console.log('1. Verify phone numbers in Twilio console (for trial accounts)')
    console.log('2. Restart your backend server')
    console.log('3. Test sending OTP from your app')
    console.log('\n💡 Tip: Check backend console logs for success/error messages')
  }
  console.log('='.repeat(60) + '\n')
}

// Run check
checkTwilioConfig().catch(console.error)




