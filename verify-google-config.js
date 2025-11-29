/**
 * Quick script to verify Google OAuth configuration
 * Run: node verify-google-config.js
 */

import dotenv from 'dotenv'
dotenv.config()

console.log('\n🔍 Google OAuth Configuration Check\n')
console.log('='.repeat(50))

const clientId = process.env.GOOGLE_CLIENT_ID

if (!clientId) {
  console.error('❌ GOOGLE_CLIENT_ID is NOT set in .env file')
  console.log('\n💡 Add this to your .env file:')
  console.log('   GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com')
} else {
  console.log('✅ GOOGLE_CLIENT_ID is set')
  console.log(`   Value: ${clientId.substring(0, 30)}...`)
  console.log(`   Full length: ${clientId.length} characters`)
  
  // Validate format
  if (clientId.includes('.apps.googleusercontent.com')) {
    console.log('✅ Format looks correct (contains .apps.googleusercontent.com)')
  } else {
    console.warn('⚠️  Format might be incorrect (should contain .apps.googleusercontent.com)')
  }
}

console.log('\n' + '='.repeat(50))
console.log('\n📝 Frontend Configuration:')
console.log('   Make sure VITE_GOOGLE_CLIENT_ID in frontend .env matches the above value')
console.log('   Then restart both frontend and backend servers\n')






