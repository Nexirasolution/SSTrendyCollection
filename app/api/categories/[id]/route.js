import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { dbConnect } from '@/lib/mongodb';
import Category from '@/models/Category';
import { requireAdmin } from '@/lib/apiAuth';
import { CATEGORY_TYPES } from '@/lib/categoryType';

const TYPE_VALUES = CATEGORY_TYPES.map((t) => t.value);

function getFilter(id) {
  return mongoose.isValidObjectId(id) ? { _id: id } : { slug: id };
}

// GET /api/categories/[id]
// Returns:
//   category      — the category itself (includes `type`), with `parent`
//                   populated (name/slug) so the storefront can render a
//                   "back to main category" breadcrumb on a subcategory
//   subcategories — direct children of this category (empty array if this
//                   category is itself a subcategory, or has none)
export async function GET(req, { params }) {
  await dbConnect();
  const category = await Category.findOne(getFilter(params.id)).populate('parent', 'name slug type');
  if (!category) return NextResponse.json({ error: 'Category not found' }, { status: 404 });

  const subcategories = await Category.find({ parent: category._id, isActive: true }).sort({ sortOrder: 1, name: 1 });

  return NextResponse.json({ category, subcategories });
}

export const PUT = requireAdmin(async (req, { params }) => {
  await dbConnect();
  const body = await req.json();

  const current = await Category.findOne(getFilter(params.id)).select('_id parent type');
  if (!current) return NextResponse.json({ error: 'Category not found' }, { status: 404 });

  if ('parent' in body) body.parent = body.parent || null;

  // Only touch `type` when the request changes the parent or the type
  // (the reorder buttons send just { sortOrder }).
  if ('parent' in body || 'type' in body) {
    const parentId = 'parent' in body ? body.parent : current.parent;

    if (parentId) {
      // Subcategories always inherit their parent's type.
      const parent = await Category.findById(parentId).select('type');
      if (!parent) return NextResponse.json({ error: 'Parent category not found' }, { status: 400 });
      body.type = parent.type || 'jewellery';
    } else if ('type' in body && !TYPE_VALUES.includes(body.type)) {
      delete body.type;
    }
  }

  const category = await Category.findOneAndUpdate({ _id: current._id }, body, { new: true });

  // Changing a main category's type carries over to all its subcategories.
  if (!category.parent && 'type' in body) {
    await Category.updateMany({ parent: category._id }, { type: category.type });
  }

  return NextResponse.json({ category });
});

export const DELETE = requireAdmin(async (req, { params }) => {
  await dbConnect();
  await Category.findOneAndDelete(getFilter(params.id));
  return NextResponse.json({ success: true });
});