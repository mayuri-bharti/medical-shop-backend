/**
 * Redis caching middleware
 * Caches GET requests for specified duration
 */

let redisClient = null
let redisInitialized = false

const initRedis = async () => {
  if (redisInitialized) return redisClient
  redisInitialized = true
  
  if (process.env.REDIS_URL) {
    try {
      const { createClient } = await import('redis')
      redisClient = createClient({ 
        url: process.env.REDIS_URL 
      })
      
      redisClient.on('error', (err) => {
        console.warn('⚠️  Redis Client Error:', err.message)
        redisClient = null
      })
      
      redisClient.on('connect', () => {
        console.log('✅ Redis Connected for Caching')
      })
      
      await redisClient.connect().catch((err) => {
        console.warn('⚠️  Could not connect to Redis:', err.message)
        redisClient = null
      })
    } catch (error) {
      console.warn('⚠️  Redis not available:', error.message)
      redisClient = null
    }
  }
  
  return redisClient
}

// Initialize Redis on module load
initRedis().catch(console.error)

/**
 * Cache middleware
 * @param {number} duration - Cache duration in seconds (default: 60)
 * @returns {Function} Express middleware
 */
export const cache = (duration = 60) => {
  return async (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next()
    }

    // Initialize Redis if not already done
    if (!redisInitialized) {
      await initRedis()
    }

    // If Redis is not available, skip caching
    if (!redisClient) {
      return next()
    }

    try {
      const key = `cache:${req.originalUrl || req.url}`
      
      // Try to get from cache
      const cached = await redisClient.get(key)
      
      if (cached) {
        // Set cache headers
        res.set('X-Cache', 'HIT')
        return res.json(JSON.parse(cached))
      }

      // Store original json function
      const originalJson = res.json.bind(res)
      
      // Override json function to cache response
      res.json = function(data) {
        // Cache the response
        if (redisClient && res.statusCode === 200) {
          redisClient.setEx(key, duration, JSON.stringify(data))
            .catch(err => console.warn('Cache set error:', err.message))
        }
        
        // Set cache headers
        res.set('X-Cache', 'MISS')
        
        // Call original json function
        return originalJson(data)
      }

      next()
    } catch (error) {
      // If caching fails, continue without cache
      console.warn('Cache middleware error:', error.message)
      next()
    }
  }
}

/**
 * Clear cache by pattern
 * @param {string} pattern - Cache key pattern (e.g., 'cache:/api/products*')
 */
export const clearCache = async (pattern = 'cache:*') => {
  if (!redisClient) {
    await initRedis()
  }
  
  if (!redisClient) return
  
  try {
    const keys = await redisClient.keys(pattern)
    if (keys.length > 0) {
      await redisClient.del(keys)
      console.log(`🗑️  Cleared ${keys.length} cache entries`)
    }
  } catch (error) {
    console.warn('Clear cache error:', error.message)
  }
}

export default { cache, clearCache, initRedis }












