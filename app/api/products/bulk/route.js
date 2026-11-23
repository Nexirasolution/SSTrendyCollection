import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/mongodb';
import Product from '@/models/Product';
import Category from '@/models/Category';
import slugify from 'slugify';
import { requireAdmin } from '@/lib/apiAuth';
import { OCCASIONS } from '@/lib/jewellery';
import { resolveCategoryType, sanitizeByType } from '@/lib/categoryType';
import { productMinPrice } from '@/lib/pricing';

// POST /api/products/bulk
// body (common): {
//   category, skuPrefix, description, careInstructions, occasion: [...],
//   weight (grams per purchase unit, required),
//   price, compareAtPrice, sizes: [{ size, stock }],
//   images: [url, ...], tags, isReadyToShip, sizeChart: [url, ...]
// }
// body (jewellery categories): material, finish, stoneType, piecesInSet
// body (dress categories):     fabric, sleeveOptions, zipOptions, pantOptions, shawlOptions
//                              (each option list = [{ label, price }])
//
// The category's `type` decides which of the type-specific fields are kept;
// the rest are dropped.
//
// Creates ONE product per image.
// - Title = auto-derived from the CATEGORY name + zero-padded number,
//   e.g. "Silk Thread Bangles" -> SILKTHREADBANGLES001, ...002...
// - SKU = admin-typed short code + zero-padded number, e.g. "MT" -> MT001...
export const POST = requireAdmin(async (req) => {
  try {
    await dbConnect();
    const body = await req.json();

    const {
      category,
      skuPrefix,
      description = '',
      occasion = [],
      careInstructions = '',
      weight = 0,
      price,
      compareAtPrice = 0,
      sizes = [],
      images = [],
      tags = [],
      isReadyToShip = false,
      sizeChart = [],
    } = body;

    if (!category) {
      return NextResponse.json({ error: 'Category is required' }, { status: 400 });
    }
    if (!skuPrefix?.trim()) {
      return NextResponse.json({ error: 'SKU code is required' }, { status: 400 });
    }
    if (!Array.isArray(images) || images.length === 0) {
      return NextResponse.json({ error: 'At least one image is required' }, { status: 400 });
    }
    if (!price || Number(price) <= 0) {
      return NextResponse.json({ error: 'Price is required' }, { status: 400 });
    }
    if (!weight || Number(weight) <= 0) {
      return NextResponse.json({ error: 'Weight (grams) is required' }, { status: 400 });
    }
    const sizeEntries = (sizes || [])
      .filter((s) => s.size)
      .map((s) => {
        const entry = { size: String(s.size).trim(), stock: Number(s.stock) || 0 };
        // Optional per-size price; blank / 0 = use the batch price.
        const sizePrice = Number(s.price);
        if (sizePrice > 0) entry.price = sizePrice;
        return entry;
      });
    if (sizeEntries.length === 0) {
      return NextResponse.json({ error: 'At least one size with stock is required' }, { status: 400 });
    }

    const sizeChartImages = Array.isArray(sizeChart)
      ? sizeChart.filter(Boolean)
      : (sizeChart ? [sizeChart] : []);

    const occasionClean = Array.isArray(occasion)
      ? occasion.filter((o) => OCCASIONS.includes(o))
      : [];

    const cat = await Category.findById(category);
    if (!cat) return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    const type = resolveCategoryType(cat);

    // --- Title code: auto-derived from the category name ---
    const titleCode = (cat.name || 'PRODUCT')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');
    if (!titleCode) {
      return NextResponse.json(
        { error: 'Category name must contain letters/numbers to generate a title' },
        { status: 400 }
      );
    }

    // --- SKU code: admin-typed short code, e.g. "MT" ---
    const skuCode = skuPrefix.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!skuCode) {
      return NextResponse.json({ error: 'SKU code must contain letters/numbers' }, { status: 400 });
    }

    // Continue title numbering from the highest existing TITLECODE### in this category
    const existingTitles = await Product.find({
      category: cat._id,
      name: { $regex: `^${titleCode}\\d+$`, $options: 'i' },
    }).select('name');

    let maxTitleNum = 0;
    const titleNumRe = new RegExp(`^${titleCode}(\\d+)$`, 'i');
    for (const p of existingTitles) {
      const match = p.name.match(titleNumRe);
      if (match) maxTitleNum = Math.max(maxTitleNum, parseInt(match[1], 10));
    }

    // Continue SKU numbering from the highest existing SKUCODE### (global)
    const existingSkus = await Product.find({
      sku: { $regex: `^${skuCode}\\d+$`, $options: 'i' },
    }).select('sku');

    let maxSkuNum = 0;
    const skuNumRe = new RegExp(`^${skuCode}(\\d+)$`, 'i');
    for (const p of existingSkus) {
      const match = p.sku?.match(skuNumRe);
      if (match) maxSkuNum = Math.max(maxSkuNum, parseInt(match[1], 10));
    }

    // Type-specific fields, cleaned and filtered for this category's type.
    const typeFields = sanitizeByType(
      {
        material: body.material,
        finish: body.finish,
        stoneType: body.stoneType,
        piecesInSet: body.piecesInSet,
        fabric: body.fabric,
        sleeveOptions: body.sleeveOptions,
        zipOptions: body.zipOptions,
        pantOptions: body.pantOptions,
        shawlOptions: body.shawlOptions,
      },
      type
    );

    const created = [];
    const errors = [];

    for (let i = 0; i < images.length; i++) {
      const titleNum = maxTitleNum + i + 1;
      const name = `${titleCode}${String(titleNum).padStart(3, '0')}`;
      const slug = slugify(name, { lower: true });

      const skuNum = maxSkuNum + i + 1;
      const sku = `${skuCode}${String(skuNum).padStart(3, '0')}`;

      try {
        const slugTaken = await Product.findOne({ slug });
        if (slugTaken) {
          errors.push({ name, error: 'A product with this generated name/slug already exists — skipped' });
          continue;
        }

        const skuTaken = await Product.findOne({ sku });
        if (skuTaken) {
          errors.push({ name, error: `Generated SKU ${sku} already exists — skipped` });
          continue;
        }

        const variant = {
          color: '',
          colorHex: '#000000',
          images: [images[i]],
          price: Number(price),
          compareAtPrice: Number(compareAtPrice) || 0,
          sizes: sizeEntries.map((s) => ({ ...s })),
        };

        const product = await Product.create({
          name,
          slug,
          sku,
          description,
          category: cat._id,
          ...typeFields,
          occasion: occasionClean,
          careInstructions: String(careInstructions || '').trim(),
          weight: Number(weight),
          tags,
          variants: [variant],
          basePrice: productMinPrice([variant]),
          isReadyToShip: !!isReadyToShip,
          sizeChart: sizeChartImages,
        });

        created.push({ id: product._id, name: product.name, sku: product.sku });
      } catch (err) {
        errors.push({ name, error: err.message });
      }
    }

    return NextResponse.json(
      { createdCount: created.length, created, errors },
      { status: created.length ? 201 : 400 }
    );
  } catch (err) {
    console.error('POST /api/products/bulk error:', err);
    return NextResponse.json({ error: err.message || 'Bulk upload failed' }, { status: 500 });
  }
});