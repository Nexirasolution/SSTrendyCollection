'use client';

import { useEffect, useState } from 'react';
import { Tag, Truck } from 'lucide-react';

// Palette — matched to the SS Trendy Shopee logo (black, gold, cream).
// Gold #D4A52A · Background #1A1A1A / #000000 · Text #FFF8E7 (cream)
const BASE = '#1A1A1A';
const BASE_DEEP = '#000000'; // darker shade of the base, used for the gradient edges
const GOLD = '#D4A52A';
const GOLD_FAINT = 'rgba(212, 165, 42, 0.7)';
const CREAM = '#FFF8E7';
const CREAM_SOFT = '#F3E6C4';

const FONT = "Georgia, 'Times New Roman', serif";

export default function CouponMarquee() {
  const [coupons, setCoupons] = useState([]);
  const [freeShippingAbove, setFreeShippingAbove] = useState(null);

  useEffect(() => {
    fetch('/api/coupons?active=true')
      .then((r) => r.json())
      .then((d) => setCoupons(d.coupons || []))
      .catch(() => {});

    fetch('/api/admin/settings')
      .then((r) => r.json())
      .then((d) => setFreeShippingAbove(d.settings?.freeShippingAbove ?? null))
      .catch(() => {});
  }, []);

  const freeShippingItem =
    freeShippingAbove != null ? { type: 'freeshipping', minOrderValue: freeShippingAbove } : null;

  const allItems = freeShippingItem ? [...coupons, freeShippingItem] : coupons;
  if (!allItems.length) return null;

  const items = [...allItems, ...allItems];

  return (
    <div
      className="relative overflow-hidden py-2"
      style={{
        background: `linear-gradient(90deg, ${BASE_DEEP}, ${BASE} 50%, ${BASE_DEEP})`,
        borderBottom: `1px solid ${GOLD}`,
      }}
    >
      {/* Fade edges */}
      <div
        className="pointer-events-none absolute left-0 top-0 bottom-0 w-12 z-10"
        style={{ background: `linear-gradient(to right, ${BASE_DEEP}, transparent)` }}
      />
      <div
        className="pointer-events-none absolute right-0 top-0 bottom-0 w-12 z-10"
        style={{ background: `linear-gradient(to left, ${BASE_DEEP}, transparent)` }}
      />

      <div className="flex animate-marquee whitespace-nowrap w-max">
        {items.map((c, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-2 mx-8 text-[12px] tracking-[0.3px]"
            style={{ color: CREAM_SOFT, fontFamily: FONT }}
          >
            {i > 0 && (
              <span className="mr-4" style={{ color: GOLD_FAINT }}>
                ◆
              </span>
            )}

            {c.type === 'freeshipping' ? (
              <>
                <Truck size={12} strokeWidth={1.25} className="shrink-0" style={{ color: GOLD }} />
                Free shipping on orders above ₹{c.minOrderValue}
              </>
            ) : (
              <>
                <Tag size={12} strokeWidth={1.25} className="shrink-0" style={{ color: GOLD }} />
                Use{' '}
                <span
                  className="italic px-1.5"
                  style={{ color: CREAM, borderBottom: `1px solid ${GOLD}` }}
                >
                  {c.code}
                </span>{' '}
                for {c.type === 'percent' ? `${c.value}% off` : `₹${c.value} off`}
                {c.minOrderValue > 0 && (
                  <span style={{ color: CREAM_SOFT, opacity: 0.8 }}>
                    {' '}
                    on orders above ₹{c.minOrderValue}
                  </span>
                )}
              </>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}