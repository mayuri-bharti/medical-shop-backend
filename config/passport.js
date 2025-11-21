import passport from 'passport'
import { Strategy as GoogleStrategy } from 'passport-google-oauth20'
import User from '../models/User.js'

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET
export const isGoogleAuthConfigured = !!(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET)

const getCallbackURL = () => {
  try {
    // For Vercel, use VERCEL_URL or custom callback URL
    if (process.env.VERCEL_URL) {
      // Vercel provides VERCEL_URL (e.g., "medical-shop-backend.vercel.app")
      return `https://${process.env.VERCEL_URL}/auth/google/callback`
    }
    // For custom deployments
    if (process.env.GOOGLE_CALLBACK_URL) {
      return process.env.GOOGLE_CALLBACK_URL
    }
    // Default to localhost for development
    return 'http://localhost:4000/auth/google/callback'
  } catch (error) {
    console.error('Error generating callback URL:', error.message)
    return 'http://localhost:4000/auth/google/callback'
  }
}

const GOOGLE_CALLBACK_URL = getCallbackURL()

// Only log warnings/errors if not in serverless cold start
if (typeof process !== 'undefined' && process.env) {
  if (!isGoogleAuthConfigured) {
    // Only warn in non-production or if explicitly requested
    if (process.env.NODE_ENV !== 'production' || process.env.LOG_OAUTH_WARNINGS === 'true') {
      console.warn('⚠️  Google OAuth credentials are not fully configured.')
      console.warn('   GOOGLE_CLIENT_ID:', GOOGLE_CLIENT_ID ? '✓ Set' : '✗ Missing')
      console.warn('   GOOGLE_CLIENT_SECRET:', GOOGLE_CLIENT_SECRET ? '✓ Set' : '✗ Missing')
    }
  } else {
    // Only log success if not in Vercel serverless (to reduce logs)
    if (!process.env.VERCEL) {
      console.log('✅ Google OAuth credentials configured')
      console.log('   Callback URL:', GOOGLE_CALLBACK_URL)
    }
  }
}

passport.serializeUser((user, done) => {
  done(null, user.id)
})

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id).select('name email phone avatar role googleId')
    done(null, user)
  } catch (error) {
    done(error, null)
  }
})

if (isGoogleAuthConfigured) {
  try {
    passport.use(
      new GoogleStrategy(
        {
          clientID: GOOGLE_CLIENT_ID,
          clientSecret: GOOGLE_CLIENT_SECRET,
          callbackURL: GOOGLE_CALLBACK_URL
        },
      async (accessToken, refreshToken, profile, done) => {
        try {
          if (!profile) {
            return done(new Error('Google profile not available'), null)
          }

          const email = profile.emails && profile.emails[0]?.value
          if (!email) {
            return done(new Error('Google account email is required'), null)
          }

          const normalizedEmail = email.toLowerCase().trim()
          const avatar = profile.photos && profile.photos[0]?.value

          console.log(`🔍 Processing Google login for: ${normalizedEmail} (Google ID: ${profile.id})`)

          // Strategy: Find existing user first, then update or create
          // This avoids phone conflicts by finding existing users

          // First, try to find by googleId
          let user = await User.findOne({ googleId: profile.id })

          if (user) {
            console.log(`✅ Found user by googleId: ${user.email}`)
            // Update user info
            if (!user.name && profile.displayName) {
              user.name = profile.displayName
            }
            if (!user.avatar && avatar) {
              user.avatar = avatar
            }
            if (!user.isVerified) {
              user.isVerified = true
            }
            await user.save()
          } else {
            // Not found by googleId, try to find by email (multiple strategies)
            // Try exact match first
            user = await User.findOne({ email: normalizedEmail })

            // If not found, try case-insensitive search
            if (!user) {
              user = await User.findOne({
                email: { $regex: new RegExp(`^${normalizedEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
              })
            }

            // If still not found, try with trimmed email (in case of whitespace issues)
            if (!user) {
              const trimmedEmail = normalizedEmail.trim()
              if (trimmedEmail !== normalizedEmail) {
                user = await User.findOne({ email: trimmedEmail })
              }
            }

            if (user) {
              console.log(`✅ Found user by email: ${user.email}`)
              // Link Google account to existing user
              if (user.googleId && user.googleId !== profile.id) {
                console.error(`❌ User ${user.email} already has different googleId: ${user.googleId}`)
                return done(new Error('Google account is already linked to a different user'), null)
              }

              // Update user with Google info
              user.googleId = profile.id
              if (!user.name && profile.displayName) {
                user.name = profile.displayName
              }
              if (!user.avatar && avatar) {
                user.avatar = avatar
              }
              if (!user.isVerified) {
                user.isVerified = true
              }

              try {
                await user.save()
                console.log(`✅ Linked Google account to existing user: ${user.email}`)
              } catch (saveError) {
                console.error(`❌ Error saving user:`, saveError.message)
                if (saveError.code === 11000) {
                  const field = Object.keys(saveError.keyPattern)[0]
                  return done(new Error(`Failed to link Google account: duplicate ${field}`), null)
                }
                throw saveError
              }
            } else {
              // No user found, create new one
              console.log(`📝 Creating new user for: ${normalizedEmail}`)

              // When phone conflict occurs, we need to find the existing user with null phone
              // and update it instead of creating a new one
              try {
                // First, try to find if there's a user with this email (might have null phone)
                let existingUser = await User.findOne({ email: normalizedEmail })
                
                if (existingUser) {
                  console.log(`✅ Found existing user by email: ${existingUser.email}`)
                  user = existingUser
                  // Link Google account
                  if (!user.googleId) {
                    user.googleId = profile.id
                  }
                  if (!user.name && profile.displayName) {
                    user.name = profile.displayName
                  }
                  if (!user.avatar && avatar) {
                    user.avatar = avatar
                  }
                  if (!user.isVerified) {
                    user.isVerified = true
                  }
                  await user.save()
                  console.log(`✅ Linked Google account to existing user`)
                } else {
                  // No user found, try to create new one
                  // Use findOneAndUpdate - $setOnInsert only for email (unique identifier)
                  // $set for all other fields that should always be updated
                  user = await User.findOneAndUpdate(
                    { email: normalizedEmail },
                    {
                      $setOnInsert: {
                        email: normalizedEmail
                        // Only email here - it's the unique identifier and shouldn't change
                      },
                      $set: {
                        googleId: profile.id,
                        name: profile.displayName || 'Google User',
                        avatar: avatar || undefined,
                        isVerified: true
                        // These fields are in $set so they update if document exists
                        // and are set if document is created
                      }
                    },
                    {
                      upsert: true,
                      new: true,
                      runValidators: false
                    }
                  )

                  if (user) {
                    // Ensure googleId is set (in case it was an existing document)
                    if (!user.googleId) {
                      user.googleId = profile.id
                      await user.save()
                    }
                    console.log(`✅ Created/updated user via findOneAndUpdate: ${user.email}`)
                  } else {
                    throw new Error('findOneAndUpdate returned null')
                  }
                }
              } catch (findUpdateError) {
                console.log(`⚠️  findOneAndUpdate failed: ${findUpdateError.message}`)
                
                // If it's a phone conflict, find the user with null phone
                if (findUpdateError.code === 11000 && findUpdateError.keyPattern?.phone) {
                  console.log(`⚠️  Phone conflict detected, searching for user with null phone...`)
                  
                  // Find user with null phone and this email
                  user = await User.findOne({
                    $or: [
                      { email: normalizedEmail, phone: { $exists: false } },
                      { email: normalizedEmail, phone: null },
                      { email: normalizedEmail, phone: '' }
                    ]
                  })
                  
                  if (user) {
                    console.log(`✅ Found user with null phone: ${user.email}`)
                    // Link Google account
                    if (!user.googleId) {
                      user.googleId = profile.id
                    }
                    if (!user.name && profile.displayName) {
                      user.name = profile.displayName
                    }
                    if (!user.avatar && avatar) {
                      user.avatar = avatar
                    }
                    if (!user.isVerified) {
                      user.isVerified = true
                    }
                    try {
                      await user.save()
                      console.log(`✅ Updated user with Google account`)
                    } catch (saveErr) {
                      console.error(`❌ Error saving: ${saveErr.message}`)
                      if (user.googleId === profile.id) {
                        console.log(`⚠️  User has correct googleId, continuing...`)
                      } else {
                        throw saveErr
                      }
                    }
                  } else {
                    // Try direct creation as last resort
                    console.log(`⚠️  Trying direct creation as last resort...`)
                    try {
                      user = new User({
                        email: normalizedEmail,
                        googleId: profile.id,
                        name: profile.displayName || 'Google User',
                        avatar: avatar || undefined,
                        isVerified: true
                      })
                      
                      await user.save()
                      console.log(`✅ Created new user via direct creation: ${user.email}`)
                    } catch (createError) {
                      console.error(`❌ Direct creation also failed: ${createError.message}`)
                      
                      // Last attempt: search one more time
                      user = await User.findOne({ 
                        $or: [
                          { email: normalizedEmail },
                          { googleId: profile.id }
                        ]
                      })
                      
                      if (!user) {
                        throw new Error(`Failed to create or find user: ${createError.message}`)
                      } else {
                        console.log(`✅ Found user in final search: ${user.email}`)
                        if (!user.googleId) {
                          user.googleId = profile.id
                          await user.save()
                        }
                      }
                    }
                  }
                } else {
                  // Other error, try to find user
                  user = await User.findOne({ 
                    $or: [
                      { email: normalizedEmail },
                      { googleId: profile.id }
                    ]
                  })
                  
                  if (!user) {
                    throw findUpdateError
                  } else {
                    console.log(`✅ Found user after error: ${user.email}`)
                    if (!user.googleId) {
                      user.googleId = profile.id
                      await user.save()
                    }
                  }
                }
              }
            }
          }

          // Final validation
          if (!user) {
            console.error(`❌ User is null after all attempts`)
            console.error(`   Email searched: ${normalizedEmail}`)
            console.error(`   Google ID: ${profile.id}`)
            
            // Last attempt: try to find user one more time
            const lastAttempt = await User.findOne({ 
              $or: [
                { email: normalizedEmail },
                { googleId: profile.id }
              ]
            })
            
            if (lastAttempt) {
              console.log(`✅ Found user in final attempt: ${lastAttempt.email}`)
              user = lastAttempt
              // Ensure googleId is set
              if (!user.googleId) {
                user.googleId = profile.id
                await user.save()
              }
            } else {
              return done(new Error('Failed to create or find user account. Please try again.'), null)
            }
          }

          if (!user.googleId || user.googleId !== profile.id) {
            console.error(`❌ Google ID mismatch after processing`)
            console.error(`   Expected: ${profile.id}, Got: ${user.googleId}`)
            // Try to fix it
            user.googleId = profile.id
            try {
              await user.save()
              console.log(`✅ Fixed googleId mismatch`)
            } catch (saveErr) {
              return done(new Error('Google account linking failed'), null)
            }
          }

          console.log(`✅ Successfully processed Google login for: ${user.email}`)
          return done(null, user)
        } catch (error) {
          console.error('❌ Google OAuth strategy error:', error.message)
          console.error('Stack:', error.stack)
          return done(error, null)
        }
      }
      )
    )
  } catch (strategyError) {
    console.error('❌ Failed to initialize Google OAuth Strategy:', strategyError.message)
    console.error('   This might be due to invalid credentials or callback URL')
    // Don't throw - allow app to continue without Google OAuth
  }
}

export default passport

