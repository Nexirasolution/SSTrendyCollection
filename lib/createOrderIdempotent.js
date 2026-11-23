import crypto from 'crypto';
import Order from '@/models/Order';
import Product from '@/models/Product';
import Coupon from '@/models/Coupon';
import { genOrderNumber } from '@/lib/utils';
import { buildOrderItemsAndTotals, OrderError } from '@/lib/orderCalc';

// Reduces stock and bumps soldCount for one purchased line.
//  - variant with sizes        → size.stock
//  - variant without sizes     → variant.stock, only when stock is tracked
//  - untracked (unlimited)     → only soldCount
async function applyStockUpdate({ productId, variantId, size, hasSizes, tracked, qty }) {
  if (hasSizes) {
    await Product.updateOne(
      { _id: productId, 'variants._id': variantId, 'variants.sizes.size': size },
      { $inc: { 'variants.$[v].sizes.$[s].stock': -qty, soldCount: qty } },
      { arrayFilters: [{ 'v._id': variantId }, { 's.size': size }] }
    );
  } else if (tracked) {
    await Product.updateOne(
      { _id: productId, 'variants._id': variantId },
      { $inc: { 'variants.$[v].stock': -qty, soldCount: qty } },
      { arrayFilters: [{ 'v._id': variantId }] }
    );
  } else {
    await Product.updateOne({ _id: productId }, { $inc: { soldCount: qty } });
  }
}

// Shared by both the client-side "fast path" (/api/orders) and the
// Razorpay webhook. Idempotent on razorpayOrderId — whichever caller
// runs first creates the order; the other gets the existing one back.
//
// opts.skipSignatureVerification: true when called from the webhook,
// which is already authenticated via the webhook's own HMAC signature
// (see /api/payment/webhook) rather than the order/payment signature
// pair Razorpay hands to the browser.
export async function createOrderIdempotent(payload, opts = {}) {
  const {
    items, customer, shippingAddress, couponCode, paymentMethod,
    razorpayOrderId, razorpayPaymentId, razorpaySignature
  } = payload;

  if (!items?.length) throw new OrderError('Cart is empty');
  if (!customer?.name || !customer?.phone) throw new OrderError('Name and phone are required');

  if (razorpayOrderId) {
    const existing = await Order.findOne({ razorpayOrderId });
    if (existing) return { order: existing, created: false };
  }

  if (paymentMethod === 'razorpay') {
    if (!razorpayOrderId || !razorpayPaymentId) {
      throw new OrderError('Missing Razorpay payment identifiers');
    }
    if (!opts.skipSignatureVerification) {
      if (!razorpaySignature) throw new OrderError('Missing payment verification data');
      const expected = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest('hex');
      if (expected !== razorpaySignature) throw new OrderError('Payment verification failed');
    }
  }

  // State-wise shipping: the same shippingAddress.state used when the
  // Razorpay order was created, so the stored total matches what was charged.
  const { orderItems, stockUpdateItems, subtotal, discount, appliedCoupon, shippingFee, total } =
    await buildOrderItemsAndTotals(items, couponCode, shippingAddress?.state);

  let order;
  try {
    order = await Order.create({
      orderNumber: genOrderNumber(),
      items: orderItems,
      customer,
      shippingAddress,
      subtotal,
      discount,
      couponCode: appliedCoupon,
      shippingFee,
      total,
      paymentMethod: paymentMethod || 'cod',
      paymentStatus: paymentMethod === 'razorpay' ? 'paid' : 'pending',
      razorpayOrderId,
      razorpayPaymentId
    });
  } catch (err) {
    // Race: client path and webhook both tried to create the same order
    // at the same instant. The unique index on razorpayOrderId rejects
    // the loser — treat that as "already created" rather than an error.
    if (err.code === 11000 && razorpayOrderId) {
      const existing = await Order.findOne({ razorpayOrderId });
      if (existing) return { order: existing, created: false };
    }
    throw err;
  }

  if (appliedCoupon) {
    await Coupon.updateOne({ code: appliedCoupon }, { $inc: { usedCount: 1 } });
  }

  for (const entry of stockUpdateItems) {
    if (entry.isCombo) {
      // orderCalc stores a combo's products as `comboLines`
      // (the old code read `comboProducts`, which was always undefined).
      for (const line of entry.comboLines) {
        await applyStockUpdate({ ...line, qty: entry.qty });
      }
      continue;
    }

    await applyStockUpdate(entry);
  }

  return { order, created: true };
}