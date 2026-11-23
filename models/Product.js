import mongoose from 'mongoose';

const VariantSchema = new mongoose.Schema(
  {
    // Colour / shade of the piece (e.g. "Maroon", "Emerald Green").
    color: { type: String, default: '' },
    colorHex: { type: String, default: '#000000' },
    images: [{ type: String }],
    price: { type: Number, required: true },
    compareAtPrice: { type: Number, default: 0 },

    // Stock for variants that have NO sizes (leave `sizes` empty).
    // Not set = stock is not tracked (unlimited). Set a number to track it.
    // Ignored when the variant has size entries (stock lives on each size).
    stock: { type: Number, min: 0, default: undefined },

    // `size` is a bangle size ("2.2", "2.4" …) or "Free Size" for jewellery,
    // and S / M / L / XL / XXL for dresses.
    // Leave this array empty for products that have no size at all.
    sizes: [
      {
        size: { type: String, required: true },
        stock: { type: Number, default: 0 },
        // Optional price for this size. Not set / 0 = use the variant price.
        price: { type: Number, min: 0, default: undefined },
        sku: { type: String }
      }
    ]
  },
  { _id: true }
);

// A selectable add-on for dresses, e.g. { label: 'Full sleeve', price: 150 }.
// price is the extra charge (0 = free).
const OptionSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true },
    price: { type: Number, default: 0, min: 0 }
  },
  { _id: false }
);

const ProductSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    sku: { type: String, required: true, unique: true, trim: true, uppercase: true },
    description: { type: String, default: '' },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },

    // ── Jewellery attributes (only used when category.type === 'jewellery') ──
    material: { type: String, default: '', trim: true },     // "Silk Thread", "Lac", "Brass"
    finish: { type: String, default: '', trim: true },       // "Gold Plated", "Oxidised"
    stoneType: { type: String, default: '', trim: true },    // "Kundan", "Pearls"
    piecesInSet: { type: Number, default: 1, min: 1 },       // a set of 4 bangles = 4

    // ── Dress attributes (only used when category.type === 'dress') ──
    fabric: { type: String, default: '', trim: true },       // "Cotton", "Georgette"
    sleeveOptions: [OptionSchema],
    zipOptions: [OptionSchema],
    pantOptions: [OptionSchema],
    shawlOptions: [OptionSchema],

    // ── Shared attributes ──
    // Occasions this piece suits: Daily Wear, Festive, Wedding, ...
    occasion: [{ type: String }],
    // Free-text care instructions shown on the product page.
    careInstructions: { type: String, default: '' },

    // Shipping weight of ONE purchase unit (one piece / set / pair) in
    // grams. 0 = not set → falls back to Settings.weightPerPiece.
    weight: { type: Number, default: 0, min: 0 },

    tags: [{ type: String }],
    variants: [VariantSchema],

    // Optional size-guide images. If empty, the storefront falls back to
    // this product's category.sizeChart instead.
    sizeChart: [{ type: String }],

    // Optional product videos, shown on the PDP below the image gallery.
    videos: [{ type: String }],

    // When true, the storefront shows a highlighted "Ready to Ship" badge.
    isReadyToShip: { type: Boolean, default: false },

    basePrice: { type: Number, required: true }, // used for listing/sorting
    rating: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },
    isBestSeller: { type: Boolean, default: false },
    isTopSeller: { type: Boolean, default: false },
    isActiveSeller: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    soldCount: { type: Number, default: 0 },
    seoTitle: String,
    seoDescription: String
  },
  { timestamps: true }
);

ProductSchema.index({ name: 'text', description: 'text', tags: 'text' });

export default mongoose.models.Product || mongoose.model('Product', ProductSchema);