import { searchCatalog } from '../services/searchService.js'

export const searchCombined = async (req, res) => {
  try {
    const { search, q, limit } = req.query
    // Support both 'search' (existing) and 'q' (new) params
    const raw = typeof q === 'string' && q.trim() ? q : search
    const trimmedSearch = typeof raw === 'string' ? raw.trim() : ''

    if (!trimmedSearch) {
      return res.status(400).json({
        success: false,
        message: 'Search term is required'
      })
    }

    const results = await searchCatalog(trimmedSearch)

    // Optional: limit results for suggestions use-case
    const max = Number.isFinite(Number(limit)) ? Math.max(1, Math.min(50, Number(limit))) : undefined
    const limited = max ? results.slice(0, max) : results

    return res.json({
      success: true,
      count: limited.length,
      results: limited
    })
  } catch (error) {
    console.error('Unified search error:', error)
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch search results'
    })
  }
}

export default {
  searchCombined
}








