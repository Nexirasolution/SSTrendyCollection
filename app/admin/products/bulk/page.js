'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { X, UploadCloud, Loader2, Plus, Upload, Trash2 } from 'lucide-react';
import { MATERIALS, FINISHES, STONE_TYPES, OCCASIONS, BANGLE_SIZES } from '@/lib/jewellery';
import {
  FABRICS,
  CLOTHING_SIZES,
  DRESS_OPTION_FIELDS,
  resolveCategoryType,
  cleanOptions,
} from '@/lib/categoryType';

const FIELD = 'w-full px-3 py-2 text-sm rounded-lg border border-brand-ink/10 outline-none bg-white';

// Keeps size names exactly as the product form / storefront filter expect
// them ("2.4", "Free Size", "XL"). Only "free size" is re-cased.
function normalizeSizeName(raw) {
  const name = String(raw || '').trim().replace(/\s+/g, ' ');
  if (name.toLowerCase() === 'free size' || name.toLowerCase() === 'freesize') return 'Free Size';
  return name;
}

// Editable list of { label, price } rows for the dress option fields.
function OptionList({ label, placeholder, items, onChange }) {
  function setItem(i, field, value) {
    onChange(items.map((it, idx) => (idx === i ? { ...it, [field]: value } : it)));
  }
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label} (optional)</label>
      {items.map((it, i) => (
        <div key={i} className="flex items-center gap-2 mb-2">
          <input
            value={it.label}
            onChange={(e) => setItem(i, 'label', e.target.value)}
            placeholder={placeholder}
            className={FIELD}
          />
          <input
            type="number"
            min="0"
            value={it.price}
            onChange={(e) => setItem(i, 'price', e.target.value)}
            placeholder="Extra ₹"
            className="w-28 shrink-0 px-3 py-2 text-sm rounded-lg border border-brand-ink/10 outline-none bg-white"
          />
          <button
            type="button"
            onClick={() => onChange(items.filter((_, idx) => idx !== i))}
            className="text-brand-ink/50 shrink-0"
            aria-label="Remove option"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, { label: '', price: 0 }])}
        className="text-xs font-medium text-brand-magenta"
      >
        + Add option
      </button>
    </div>
  );
}

export default function BulkAddProductsPage() {
  const router = useRouter();
  const [categories, setCategories] = useState([]);
  const [category, setCategory] = useState('');
  const [categorySizes, setCategorySizes] = useState([]);

  const [skuPrefix, setSkuPrefix] = useState(''); // short code used to build SKUs, e.g. "MT" -> MT001
  const [description, setDescription] = useState('');
  const [weight, setWeight] = useState(''); // grams per purchase unit, used for shipping
  const [price, setPrice] = useState('');
  const [compareAtPrice, setCompareAtPrice] = useState('');
  const [stockBySize, setStockBySize] = useState({}); // { '2.4': 10, 'M': 5, ... }
  const [priceBySize, setPriceBySize] = useState({}); // optional per-size price, { 'XL': 1299 } — blank = batch price
  const [tagsText, setTagsText] = useState(''); // comma separated, parsed on submit

  // Jewellery attributes — only sent for jewellery categories.
  const [material, setMaterial] = useState('');
  const [finish, setFinish] = useState('');
  const [stoneType, setStoneType] = useState('');
  const [piecesInSet, setPiecesInSet] = useState('1');

  // Dress attributes — only sent for dress categories.
  const [fabric, setFabric] = useState('');
  const [dressOptions, setDressOptions] = useState({
    sleeveOptions: [],
    zipOptions: [],
    pantOptions: [],
    shawlOptions: [],
  });

  // Shared attributes
  const [occasion, setOccasion] = useState([]);
  const [careInstructions, setCareInstructions] = useState('');
  const [isReadyToShip, setIsReadyToShip] = useState(false);

  // Optional shared size-guide images. Empty = fall back to the category's.
  const [sizeChart, setSizeChart] = useState([]);
  const [sizeChartUploading, setSizeChartUploading] = useState(false);

  // Manual size entry for categories with no predefined sizes
  const [manualSizeName, setManualSizeName] = useState('');
  const [manualSizeStock, setManualSizeStock] = useState('');
  const [manualSizePrice, setManualSizePrice] = useState('');
  const [manualSizes, setManualSizes] = useState([]); // [{ size, stock, price }]

  const [files, setFiles] = useState([]); // File[]
  const [previews, setPreviews] = useState([]); // objectURL[]
  const previewsRef = useRef([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    fetch('/api/categories')
      .then((r) => r.json())
      .then((d) => setCategories(d.categories || []))
      .catch(() => toast.error('Failed to load categories'));
  }, []);

  // Free the browser memory held by image previews when leaving the page.
  useEffect(() => {
    previewsRef.current = previews;
  }, [previews]);
  useEffect(() => {
    return () => previewsRef.current.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  const selectedCategory = categories.find((c) => c._id === category);
  const categoryType = selectedCategory ? resolveCategoryType(selectedCategory) : null;
  const isDress = categoryType === 'dress';
  const isJewellery = categoryType === 'jewellery';

  // Preview of what the auto-generated title prefix will look like, purely cosmetic
  const titlePreview = (selectedCategory?.name || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '') || 'CATEGORY';

  // When the category changes: reset sizes and type-specific fields.
  // Dress categories without their own size list default to S–XXL.
  useEffect(() => {
    const cat = categories.find((c) => c._id === category);
    const type = cat ? resolveCategoryType(cat) : null;
    const sizes = cat?.sizes?.length ? cat.sizes : type === 'dress' ? CLOTHING_SIZES : [];
    setCategorySizes(sizes);
    setStockBySize(Object.fromEntries(sizes.map((s) => [s, ''])));
    setPriceBySize({});
    setManualSizes([]);
    setManualSizeName('');
    setManualSizeStock('');
    setManualSizePrice('');

    // Don't carry jewellery values into a dress batch or vice versa.
    setMaterial('');
    setFinish('');
    setStoneType('');
    setPiecesInSet('1');
    setFabric('');
    setDressOptions({ sleeveOptions: [], zipOptions: [], pantOptions: [], shawlOptions: [] });
  }, [category, categories]);

  function toggleOccasion(opt) {
    setOccasion((prev) => (prev.includes(opt) ? prev.filter((o) => o !== opt) : [...prev, opt]));
  }

  function handleFilesChange(e) {
    const selected = Array.from(e.target.files || []);
    setFiles((prev) => [...prev, ...selected]);
    setPreviews((prev) => [...prev, ...selected.map((f) => URL.createObjectURL(f))]);
    e.target.value = '';
  }

  function removeImage(idx) {
    URL.revokeObjectURL(previews[idx]);
    setFiles((prev) => prev.filter((_, i) => i !== idx));
    setPreviews((prev) => prev.filter((_, i) => i !== idx));
  }

  function addManualSize() {
    const name = normalizeSizeName(manualSizeName);
    if (!name) return toast.error(`Enter a size (e.g. ${isDress ? 'M, XL, Free Size' : '2.4, Free Size'})`);
    if (manualSizes.some((s) => s.size.toLowerCase() === name.toLowerCase())) {
      return toast.error('That size is already added');
    }
    setManualSizes((prev) => [...prev, { size: name, stock: manualSizeStock || '0', price: manualSizePrice }]);
    setManualSizeName('');
    setManualSizeStock('');
    setManualSizePrice('');
  }

  // One tap to add the standard size list for this type, each with the stock typed above.
  function addStandardSizes() {
    const list = isDress ? CLOTHING_SIZES : BANGLE_SIZES;
    setManualSizes((prev) => {
      const existing = new Set(prev.map((s) => s.size.toLowerCase()));
      const toAdd = list
        .filter((size) => !existing.has(size.toLowerCase()))
        .map((size) => ({ size, stock: manualSizeStock || '0', price: manualSizePrice }));
      return [...prev, ...toAdd];
    });
  }

  function removeManualSize(name) {
    setManualSizes((prev) => prev.filter((s) => s.size !== name));
  }

  async function uploadImage(file) {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('/api/upload', { method: 'POST', body: formData });
    if (!res.ok) throw new Error(`Failed to upload ${file.name}`);
    const data = await res.json();
    return data.url;
  }

  async function handleSizeChartFilesChange(e) {
    const selected = Array.from(e.target.files || []);
    if (selected.length === 0) return;

    setSizeChartUploading(true);
    try {
      const uploaded = [];
      for (const file of selected) {
        const url = await uploadImage(file);
        uploaded.push(url);
      }
      setSizeChart((prev) => [...prev, ...uploaded]);
      toast.success(`${uploaded.length} size guide image${uploaded.length > 1 ? 's' : ''} uploaded`);
    } catch (err) {
      toast.error(err.message || 'Failed to upload size guide');
    } finally {
      setSizeChartUploading(false);
      e.target.value = '';
    }
  }

  function removeSizeChartImage(idx) {
    setSizeChart((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setResult(null);

    if (!category) return toast.error('Select a category');
    if (!skuPrefix.trim()) return toast.error('Enter a SKU code (e.g. MT)');
    if (!price || Number(price) <= 0) return toast.error('Enter a valid price');
    if (Number(compareAtPrice) > 0 && Number(compareAtPrice) < Number(price)) {
      return toast.error('Compare-at price should be higher than the price');
    }
    if (!weight || Number(weight) <= 0) return toast.error('Enter a valid weight in grams');
    if (files.length === 0) return toast.error('Add at least one image');

    // Combine predefined-size stock and manually-added sizes
    const fromPredefined = Object.entries(stockBySize)
      .filter(([, stock]) => stock !== '')
      .map(([size, stock]) => ({
        size: normalizeSizeName(size),
        stock: Math.max(0, Number(stock) || 0),
        price: Number(priceBySize[size]) > 0 ? Number(priceBySize[size]) : undefined,
      }));

    const fromManual = manualSizes.map((s) => ({
      size: normalizeSizeName(s.size),
      stock: Math.max(0, Number(s.stock) || 0),
      price: Number(s.price) > 0 ? Number(s.price) : undefined,
    }));

    // De-duplicate case-insensitively (first entry wins).
    const seen = new Set();
    const sizes = [...fromPredefined, ...fromManual].filter((s) => {
      const key = s.size.toLowerCase();
      if (!s.size || seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const badPrice = [...Object.entries(priceBySize)].find(([, p]) => String(p).trim() !== '' && !(Number(p) > 0));
    if (badPrice) return toast.error(`Size ${badPrice[0]}: enter a valid price or leave it blank`);

    if (sizes.length === 0) {
      if (categorySizes.length === 0) {
        return toast.error('This category has no sizes configured — add a size manually below, or set sizes on the category first.');
      }
      return toast.error('Enter stock for at least one size');
    }

    setSubmitting(true);
    try {
      // 1. Upload every image first, one product will be created per URL
      const imageUrls = [];
      for (const file of files) {
        const url = await uploadImage(file);
        imageUrls.push(url);
      }

      // 2. Only send the fields that belong to this category's type.
      const typeFields = isDress
        ? {
            fabric,
            sleeveOptions: cleanOptions(dressOptions.sleeveOptions),
            zipOptions: cleanOptions(dressOptions.zipOptions),
            pantOptions: cleanOptions(dressOptions.pantOptions),
            shawlOptions: cleanOptions(dressOptions.shawlOptions),
          }
        : {
            material,
            finish,
            stoneType,
            piecesInSet: Math.max(1, Math.floor(Number(piecesInSet)) || 1),
          };

      // 3. Create products in bulk
      const res = await fetch('/api/products/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          skuPrefix,
          description,
          ...typeFields,
          occasion,
          careInstructions,
          weight: Number(weight),
          price: Number(price),
          compareAtPrice: Number(compareAtPrice) || 0,
          sizes,
          images: imageUrls,
          tags: tagsText.split(',').map((t) => t.trim()).filter(Boolean),
          isReadyToShip,
          sizeChart,
        }),
      });

      let data;
      try {
        data = await res.json();
      } catch {
        throw new Error(`Server returned an unexpected response (status ${res.status})`);
      }

      if (!res.ok) throw new Error(data.error || `Bulk upload failed (status ${res.status})`);

      setResult(data);
      if (data.createdCount > 0) {
        toast.success(`${data.createdCount} product${data.createdCount > 1 ? 's' : ''} created`);
      }
      if (data.errors?.length) {
        toast.error(`${data.errors.length} item(s) skipped — see details below`);
      }
    } catch (err) {
      toast.error(err.message || 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-2xl font-bold text-brand-magenta mb-1">Bulk Add Products</h1>
      <p className="text-sm text-brand-ink/50 mb-6">
        One category, description and weight applied to every piece. Each image you upload becomes its own
        product — titles are generated automatically from the category, and SKUs from the code below. The
        fields shown depend on the category: jewellery or dress.
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={FIELD}
              required
            >
              <option value="">Select category...</option>
              {categories.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}{resolveCategoryType(c) === 'dress' ? ' (Dress)' : ''}
                </option>
              ))}
            </select>
            {category && (
              <p className="text-xs text-brand-ink/40 mt-1">
                {isDress ? 'Dress form' : 'Jewellery form'} · Titles auto-generate as {titlePreview}001, {titlePreview}002...
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">SKU code</label>
            <input
              value={skuPrefix}
              onChange={(e) => setSkuPrefix(e.target.value)}
              placeholder="e.g. ST"
              className={FIELD}
              required
            />
            <p className="text-xs text-brand-ink/40 mt-1">
              SKUs auto-generate as {skuPrefix ? skuPrefix.toUpperCase() : 'ST'}001, {skuPrefix ? skuPrefix.toUpperCase() : 'ST'}002...
            </p>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Price</label>
            <input
              type="number"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className={FIELD}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Compare-at price (optional)</label>
            <input
              type="number"
              min="0"
              value={compareAtPrice}
              onChange={(e) => setCompareAtPrice(e.target.value)}
              className={FIELD}
            />
          </div>
        </div>

        {!categoryType && (
          <p className="text-sm text-brand-ink/50 border border-dashed border-brand-ink/15 rounded-lg p-3">
            Choose a category to see the matching fields.
          </p>
        )}

        {/* ── Jewellery attributes ── */}
        {isJewellery && (
          <>
            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Material</label>
                <select value={material} onChange={(e) => setMaterial(e.target.value)} className={FIELD}>
                  <option value="">— Not specified —</option>
                  {MATERIALS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Finish / plating</label>
                <select value={finish} onChange={(e) => setFinish(e.target.value)} className={FIELD}>
                  <option value="">— Not specified —</option>
                  {FINISHES.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Stone / decorative work</label>
                <select value={stoneType} onChange={(e) => setStoneType(e.target.value)} className={FIELD}>
                  <option value="">— None —</option>
                  {STONE_TYPES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Pieces in a set</label>
              <input
                type="number"
                min="1"
                value={piecesInSet}
                onChange={(e) => setPiecesInSet(e.target.value)}
                className={FIELD}
              />
              <p className="text-xs text-brand-ink/40 mt-1">
                1 = sold singly. Enter 4 for a set of 4 bangles, 2 for a pair, and so on.
              </p>
            </div>
          </>
        )}

        {/* ── Dress attributes ── */}
        {isDress && (
          <>
            <div>
              <label className="block text-sm font-medium mb-1">Fabric</label>
              <select value={fabric} onChange={(e) => setFabric(e.target.value)} className={FIELD}>
                <option value="">— Not specified —</option>
                {FABRICS.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              {DRESS_OPTION_FIELDS.map(({ key, label, placeholder }) => (
                <OptionList
                  key={key}
                  label={label}
                  placeholder={placeholder}
                  items={dressOptions[key]}
                  onChange={(items) => setDressOptions((prev) => ({ ...prev, [key]: items }))}
                />
              ))}
            </div>
          </>
        )}

        {/* Weight applies to both types */}
        <div>
          <label className="block text-sm font-medium mb-1">
            {isDress ? 'Weight per piece (grams)' : 'Weight per set / piece (grams)'}
          </label>
          <input
            type="number"
            min="1"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder="e.g. 120"
            className={FIELD}
            required
          />
          <p className="text-xs text-brand-ink/40 mt-1">
            Used to calculate shipping. Applied to every product in this batch.
          </p>
        </div>

        {categoryType && (
          <div>
            <label className="block text-sm font-medium mb-2">Occasion (optional)</label>
            <div className="flex flex-wrap gap-3">
              {OCCASIONS.map((opt) => (
                <label key={opt} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={occasion.includes(opt)}
                    onChange={() => toggleOccasion(opt)}
                    className="w-4 h-4"
                  />
                  {opt}
                </label>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1">Tags (optional, comma separated)</label>
          <input
            value={tagsText}
            onChange={(e) => setTagsText(e.target.value)}
            placeholder={isDress ? 'e.g. kurti, cotton, printed' : 'e.g. silk thread, bridal, red'}
            className={FIELD}
          />
          <p className="text-xs text-brand-ink/40 mt-1">Applied to every product in this batch.</p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className={FIELD}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Care instructions (optional)</label>
          <textarea
            value={careInstructions}
            onChange={(e) => setCareInstructions(e.target.value)}
            rows={2}
            placeholder={
              isDress
                ? 'e.g. Gentle hand wash in cold water. Do not bleach. Iron on low heat.'
                : 'e.g. Keep away from water and perfume. Store in the box provided.'
            }
            className={FIELD}
          />
        </div>

        {/* Size guide — optional, shared across every product in this batch */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Size guide images (optional — applied to every product in this batch, falls back to the category's size guide if left empty)
          </label>
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
            {sizeChart.map((url, idx) => (
              <div key={idx} className="relative aspect-square rounded-md overflow-hidden bg-brand-ink/5">
                <img src={url} alt="" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeSizeChartImage(idx)}
                  className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center text-white"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
            <button
              type="button"
              disabled={sizeChartUploading}
              onClick={() => document.getElementById('bulk-size-chart-input')?.click()}
              className="aspect-square rounded-md border-2 border-dashed border-brand-ink/20 flex flex-col items-center justify-center gap-1 text-brand-ink/40 hover:border-brand-magenta/40 disabled:opacity-50"
            >
              {sizeChartUploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              <span className="text-[10px]">{sizeChartUploading ? 'Uploading…' : 'Add'}</span>
            </button>
          </div>
          <input
            id="bulk-size-chart-input"
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleSizeChartFilesChange}
          />
        </div>

        {/* Ready to ship — applies to every product created in this batch */}
        <label className="flex items-center gap-2 text-sm cursor-pointer w-fit">
          <input
            type="checkbox"
            checked={isReadyToShip}
            onChange={(e) => setIsReadyToShip(e.target.checked)}
            className="w-4 h-4"
          />
          Mark all products in this batch as "Ready to Ship"
        </label>

        {/* Predefined sizes from the category (dress categories default to S–XXL) */}
        {categorySizes.length > 0 && (
          <div>
            <label className="block text-sm font-medium mb-2">Stock and price per size (applies to every product)</label>
            <div className="flex flex-wrap gap-3">
              {categorySizes.map((size) => (
                <div key={size} className="flex items-center gap-2">
                  <span className="text-xs font-semibold min-w-[2rem]">{size}</span>
                  <input
                    type="number"
                    min="0"
                    value={stockBySize[size] ?? ''}
                    onChange={(e) => setStockBySize((prev) => ({ ...prev, [size]: e.target.value }))}
                    placeholder="0"
                    className="w-20 px-2 py-1.5 text-sm rounded-lg border border-brand-ink/10 outline-none bg-white"
                  />
                  <input
                    type="number"
                    min="0"
                    value={priceBySize[size] ?? ''}
                    onChange={(e) => setPriceBySize((prev) => ({ ...prev, [size]: e.target.value }))}
                    placeholder="Price ₹"
                    title="Leave blank to use the batch price"
                    className="w-24 px-2 py-1.5 text-sm rounded-lg border border-brand-ink/10 outline-none bg-white"
                  />
                </div>
              ))}
            </div>
            <p className="text-xs text-brand-ink/40 mt-1">
              Price per size is optional — leave it blank to use the price entered above.
            </p>
          </div>
        )}

        {/* Fallback: category has no sizes configured, let admin add sizes manually for this batch */}
        {category && categorySizes.length === 0 && (
          <div className="border border-brand-gold/40 bg-brand-gold/5 rounded-lg p-3">
            <p className="text-sm font-medium mb-1">No sizes configured for this category</p>
            <p className="text-xs text-brand-ink/50 mb-3">
              Add sizes here for this batch (bangle sizes like 2.4, or "Free Size" for adjustable pieces), or go to Categories and set sizes so this shows automatically next time.
            </p>

            <div className="flex flex-wrap items-end gap-2 mb-3">
              <div>
                <label className="block text-xs text-brand-ink/50 mb-1">Size</label>
                <input
                  value={manualSizeName}
                  onChange={(e) => setManualSizeName(e.target.value)}
                  placeholder="e.g. 2.4, Free Size"
                  className="w-36 px-2 py-1.5 text-sm rounded-lg border border-brand-ink/10 outline-none bg-white"
                />
              </div>
              <div>
                <label className="block text-xs text-brand-ink/50 mb-1">Stock</label>
                <input
                  type="number"
                  min="0"
                  value={manualSizeStock}
                  onChange={(e) => setManualSizeStock(e.target.value)}
                  placeholder="0"
                  className="w-24 px-2 py-1.5 text-sm rounded-lg border border-brand-ink/10 outline-none bg-white"
                />
              </div>
              <div>
                <label className="block text-xs text-brand-ink/50 mb-1">Price (optional)</label>
                <input
                  type="number"
                  min="0"
                  value={manualSizePrice}
                  onChange={(e) => setManualSizePrice(e.target.value)}
                  placeholder="Batch price"
                  className="w-28 px-2 py-1.5 text-sm rounded-lg border border-brand-ink/10 outline-none bg-white"
                />
              </div>
              <button
                type="button"
                onClick={addManualSize}
                className="flex items-center gap-1 text-sm border rounded-lg px-3 py-1.5 hover:border-brand-magenta transition-colors"
              >
                <Plus size={14} /> Add
              </button>
              <button
                type="button"
                onClick={addStandardSizes}
                className="flex items-center gap-1 text-sm border rounded-lg px-3 py-1.5 hover:border-brand-magenta transition-colors"
              >
                <Plus size={14} /> Add all {isDress ? 'sizes' : 'bangle sizes'} ({(isDress ? CLOTHING_SIZES : BANGLE_SIZES).join(', ')})
              </button>
            </div>

            {manualSizes.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {manualSizes.map((s) => (
                  <span
                    key={s.size}
                    className="flex items-center gap-1 text-xs bg-white border border-brand-ink/10 rounded-full px-2 py-1"
                  >
                    {s.size}: {s.stock}{Number(s.price) > 0 ? ` · ₹${s.price}` : ''}
                    <button type="button" onClick={() => removeManualSize(s.size)}>
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-2">
            Images ({files.length} selected — one product per image)
          </label>
          <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-brand-ink/15 rounded-lg py-8 cursor-pointer text-brand-ink/50 hover:border-brand-magenta/40">
            <UploadCloud size={22} />
            <span className="text-sm">Click to select images</span>
            <input type="file" accept="image/*" multiple onChange={handleFilesChange} className="hidden" />
          </label>

          {previews.length > 0 && (
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-3 mt-4">
              {previews.map((src, idx) => (
                <div key={src} className="relative aspect-square rounded-md overflow-hidden bg-brand-ink/5">
                  <img src={src} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeImage(idx)}
                    className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center text-white"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <button type="submit" disabled={submitting} className="btn-primary flex items-center gap-2 text-sm disabled:opacity-60">
          {submitting && <Loader2 size={16} className="animate-spin" />}
          {submitting ? 'Creating products...' : `Create ${files.length || ''} Product${files.length === 1 ? '' : 's'}`}
        </button>
      </form>

      {result && (
        <div className="mt-6 card-soft p-4 text-sm">
          <p className="font-medium mb-2">{result.createdCount} product(s) created.</p>
          {result.errors?.length > 0 && (
            <div className="text-brand-ink/60">
              <p className="font-medium text-brand-magenta mb-1">Skipped:</p>
              <ul className="list-disc pl-5 space-y-0.5">
                {result.errors.map((e, i) => (
                  <li key={i}>{e.name}: {e.error}</li>
                ))}
              </ul>
            </div>
          )}
          <button onClick={() => router.push('/admin/products')} className="mt-3 text-brand-magenta underline text-sm">
            Go to product list
          </button>
        </div>
      )}
    </div>
  );
}