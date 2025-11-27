import AllMedicine from '../../models/AllMedicine.js'
import Product from '../../models/Product.js'
import { normalizeSearchResult } from '../utils/normalizeSearchResult.js'
import { ensureDatabaseConnection } from '../utils/ensureDatabaseConnection.js'

export const searchCatalog = async (term) => {
  if (!term || !term.trim()) {
    return []
  }

  await ensureDatabaseConnection()

  const searchRegex = new RegExp(term.trim(), 'i')

  const [medicines, products] = await Promise.all([
    AllMedicine.find({
      name: { $regex: searchRegex },
      $or: [
        { isActive: { $exists: false } },
        { isActive: { $ne: false } }
      ]
    })
      .select('name price image images category manufacturer brand pack_size packSize type')
      .lean(),
    Product.find({
      isActive: true,
      name: { $regex: searchRegex }
    })
      .select('name price images category brand sku')
      .lean()
  ])

  const normalizedMedicines = medicines.map((medicine) =>
    normalizeSearchResult(medicine, 'medicine')
  )

  const normalizedProducts = products.map((product) =>
    normalizeSearchResult(product, 'product')
  )

  const combined = [...normalizedMedicines, ...normalizedProducts]

  combined.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))

  return combined
}

export default {
  searchCatalog
}








