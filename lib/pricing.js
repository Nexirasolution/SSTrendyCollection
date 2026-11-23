// Per-size pricing helpers.
//
// A size can carry its own `price`. If it is blank / 0, the size uses the
// variant's `price`. Use these helpers everywhere a price is read
// (product page, cart, checkout, order creation) so they all agree.

// Price of one size of a variant (falls back to the variant price).
export function getSizePrice(variant, size) {
  const entry = (variant?.sizes || []).find((s) => s.size === size);
  const sizePrice = Number(entry?.price);
  return sizePrice > 0 ? sizePrice : Number(variant?.price) || 0;
}

// Effective price of every size of a variant. A variant with no sizes
// just has its own price.
export function variantPrices(variant) {
  const sizes = (variant?.sizes || []).filter((s) => s.size);
  if (sizes.length === 0) return [Number(variant?.price) || 0];
  return sizes.map((s) => getSizePrice(variant, s.size));
}

// Lowest price a variant can be bought at ("From ₹…").
export function variantMinPrice(variant) {
  return Math.min(...variantPrices(variant));
}

// Lowest price across all variants — stored as product.basePrice for
// listing and price sorting/filtering.
export function productMinPrice(variants = []) {
  if (!variants.length) return 0;
  return Math.min(...variants.map(variantMinPrice));
}

// True when the sizes of a variant are not all the same price.
export function hasVaryingPrices(variant) {
  return new Set(variantPrices(variant)).size > 1;
}