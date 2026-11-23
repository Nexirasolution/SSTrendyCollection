// Single source of truth for "is this a jewellery category or a dress category?".
// Used by the admin forms, the bulk uploader, the API routes and the product page.

export const CATEGORY_TYPES = [
  { value: 'jewellery', label: 'Jewellery (bangles, necklaces, earrings…)' },
  { value: 'dress', label: 'Dress / clothing (kurtis, suits, lehengas…)' },
];

export const CLOTHING_SIZES = ['S', 'M', 'L', 'XL', 'XXL'];

export const FABRICS = [
  'Cotton', 'Rayon', 'Georgette', 'Chiffon', 'Crepe', 'Silk', 'Chanderi',
  'Linen', 'Velvet', 'Net', 'Organza', 'Satin',
];

// Fields that only make sense for one product type.
export const JEWELLERY_ONLY_FIELDS = ['material', 'finish', 'stoneType', 'piecesInSet'];
export const DRESS_ONLY_FIELDS = ['fabric', 'sleeveOptions', 'zipOptions', 'pantOptions', 'shawlOptions'];

// The four dress option lists, with the label shown in the admin forms.
export const DRESS_OPTION_FIELDS = [
  { key: 'sleeveOptions', label: 'Sleeve options', placeholder: 'e.g. Full sleeve, 3/4 sleeve' },
  { key: 'zipOptions', label: 'Zip options', placeholder: 'e.g. Side zip, Front zip' },
  { key: 'pantOptions', label: 'Pant / bottom options', placeholder: 'e.g. Palazzo, Straight pant' },
  { key: 'shawlOptions', label: 'Dupatta / shawl options', placeholder: 'e.g. Net dupatta, Chiffon dupatta' },
];

// Anything that isn't explicitly "dress" is treated as jewellery, so
// categories created before the `type` field existed keep working.
export function resolveCategoryType(category) {
  return category?.type === 'dress' ? 'dress' : 'jewellery';
}

// Option lists are stored as [{ label, price }] where price is an optional
// extra charge (0 = free). Older data may be a plain string array.
export function normalizeOptions(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map((o) => (typeof o === 'string' ? { label: o, price: 0 } : { label: o?.label || '', price: o?.price ?? 0 }))
    .map((o) => ({ label: String(o.label), price: o.price }));
}

// Drops blank rows and coerces prices to numbers. Use right before saving.
export function cleanOptions(list) {
  return normalizeOptions(list)
    .map((o) => ({ label: o.label.trim(), price: Math.max(0, Number(o.price) || 0) }))
    .filter((o) => o.label);
}

// Removes fields that don't belong to the given type and tidies the rest.
// Runs on the server for every create/update so a stale client can never
// store jewellery fields on a dress (or the other way round).
export function sanitizeByType(input, type) {
  const out = { ...input };

  if (type === 'dress') {
    JEWELLERY_ONLY_FIELDS.forEach((k) => delete out[k]);
    if ('fabric' in out) out.fabric = String(out.fabric || '').trim();
    DRESS_OPTION_FIELDS.forEach(({ key }) => {
      if (key in out) out[key] = cleanOptions(out[key]);
    });
  } else {
    DRESS_ONLY_FIELDS.forEach((k) => delete out[k]);
    ['material', 'finish', 'stoneType'].forEach((k) => {
      if (k in out) out[k] = String(out[k] || '').trim();
    });
    if ('piecesInSet' in out) out.piecesInSet = Math.max(1, Math.floor(Number(out.piecesInSet)) || 1);
  }

  return out;
}