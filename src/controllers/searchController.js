import { searchCatalog } from '../services/searchService.js'

export const searchCombined = async (req, res) => {
  try {
    const { search } = req.query
    const trimmedSearch = typeof search === 'string' ? search.trim() : ''

    if (!trimmedSearch) {
      return res.status(400).json({
        success: false,
        message: 'Search term is required'
      })
    }

    const results = await searchCatalog(trimmedSearch)

    return res.json({
      success: true,
      count: results.length,
      results
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




