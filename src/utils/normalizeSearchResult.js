const toSafeString = (value) => {
  if (typeof value === 'string') {
    return value.trim()
  }

  if (value === null || value === undefined) {
    return ''
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value.toString()
  }

  return ''
}

const toSafeNumber = (value) => {
  if (value === null || value === undefined || value === '') {
    return ''
  }

  let numericValue = value

  if (typeof value === 'string') {
    const sanitized = value
      .replace(/[₹$,]/g, '')
      .replace(/\s*(per|\/).*/i, '')
      .trim()
    numericValue = sanitized === '' ? value : sanitized
  }

  const parsed = Number(numericValue)
  if (Number.isFinite(parsed)) {
    return parsed
  }

  return toSafeString(value)
}

const extractImage = (doc) => {
  if (!doc) return ''

  if (Array.isArray(doc.images) && doc.images.length > 0) {
    const first = doc.images[0]
    if (typeof first === 'string') {
      return toSafeString(first)
    }
    if (first && typeof first === 'object') {
      return first.url || first.secure_url || first.src || ''
    }
  }

  const candidates = [
    doc.image,
    doc.image_url,
    doc.thumbnail,
    doc.thumbnail_url,
    doc.photo,
    doc.picture,
    doc.imageUrl
  ]

  for (const candidate of candidates) {
    const safe = toSafeString(candidate)
    if (safe) return safe
  }

  return ''
}

const firstNonEmpty = (doc, fields = []) => {
  for (const field of fields) {
    if (!field) continue
    const value = field.split('.').reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), doc)
    const safe = toSafeString(value)
    if (safe) {
      return safe
    }
  }
  return ''
}

export const normalizeSearchResult = (doc, source) => {
  if (!doc) {
    return {
      id: '',
      name: '',
      price: '',
      image: '',
      category: '',
      manufacturer: '',
      pack_size: '',
      type: ''
    }
  }

  const id = toSafeString(doc._id ? doc._id.toString() : '')

  const name = firstNonEmpty(doc, [
    'name',
    'title',
    'product_name',
    'medicine_name',
    'display_name'
  ])

  const image = extractImage(doc)

  const category = firstNonEmpty(doc, [
    'category',
    'category_name',
    'categoryName',
    'segment',
    'group',
    'sub_category',
    'subcategory',
    'therapeutic_class',
    'type'
  ]) || (source === 'medicine' ? 'Medicine' : '')

  const manufacturer = firstNonEmpty(doc, [
    'manufacturer',
    'manufacturer_name',
    'manufacturerName',
    'brand',
    'company',
    'mfg',
    'mfgName',
    'maker'
  ])

  const packSize = firstNonEmpty(doc, [
    'pack_size',
    'packSize',
    'pack',
    'packaging',
    'pack_size_label',
    'size',
    'packsize'
  ])

  const price = toSafeNumber(
    doc.price ??
    doc.mrp ??
    doc['price(₹)'] ??
    doc.selling_price ??
    doc.sale_price ??
    doc.discounted_price
  )

  const type = source === 'product'
    ? 'product'
    : source === 'medicine'
      ? 'medicine'
      : toSafeString(doc.type) || ''

  return {
    id,
    name,
    price,
    image,
    category,
    manufacturer,
    pack_size: packSize,
    type
  }
}

export default normalizeSearchResult
