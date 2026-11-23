import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { dbConnect } from '@/lib/mongodb';
import Product from '@/models/Product';
import Category from '@/models/Category';
import Review from '@/models/Review';
import { requireAdmin } from '@/lib/apiAuth';
import { resolveCategoryType, sanitizeByType } from '@/lib/categoryType';
import { productMinPrice } from '@/lib/pricing';

function getFilter(id) {
  return mongoose.isValidObjectId(id) ? { _id: id } : { slug: id };
}

export async function GET(req, { params }) {
  await dbConnect();

  // `type` and `sizeChart` are selected on the category populate — the
  // product page uses category.type to pick the jewellery or dress layout,
  // and falls back to category.sizeChart when the product has none of its own.
  const product = await Product.findOne({
    ...getFilter(params.id),
    isActive: true,
  }).populate('category', 'name slug sizes type sizeChart');

  if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

  const reviews = await Review.find({ product: product._id, isApproved: true }).sort({ createdAt: -1 });

  // The category may have been deleted; skip "related" instead of crashing.
  const categoryId = product.category?._id;
  const related = categoryId
    ? await Product.find({
        category: categoryId,
        _id: { $ne: product._id },
        isActive: true,
      })
        .limit(8)
        .select('name slug basePrice variants rating')
        .populate('category', 'name slug type sizeChart')
    : [];

  return NextResponse.json({ product, reviews, related });
}

export const PUT = requireAdmin(async (req, { params }) => {
  await dbConnect();
  const body = await req.json();

  const current = await Product.findOne(getFilter(params.id)).select('_id category sku');
  if (!current) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

  // SKU is auto-managed and permanently locked after creation.
  delete body.sku;

  if (body.variants?.length) {
    body.basePrice = productMinPrice(body.variants);
  }

  // Work out the product type from the (possibly new) category, then drop
  // fields that belong to the other type and clean the rest.
  const categoryId = body.category || current.category;
  const cat = await Category.findById(categoryId).select('type');
  const type = resolveCategoryType(cat);
  const clean = sanitizeByType(body, type);

  // Fields of the other type that were stored earlier (e.g. the category was
  // switched from dress to jewellery) are removed from the document.
  const unset =
    type === 'dress'
      ? { material: '', finish: '', stoneType: '', piecesInSet: '' }
      : { fabric: '', sleeveOptions: '', zipOptions: '', pantOptions: '', shawlOptions: '' };

  const product = await Product.findOneAndUpdate(
    getFilter(params.id),
    { $set: clean, $unset: unset },
    { new: true, runValidators: true }
  );
  if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

  return NextResponse.json({ product });
});

export const DELETE = requireAdmin(async (req, { params }) => {
  await dbConnect();
  await Product.findOneAndDelete(getFilter(params.id));
  return NextResponse.json({ success: true });
});