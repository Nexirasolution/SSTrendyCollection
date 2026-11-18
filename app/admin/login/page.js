'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

// Palette: Primary #A67C00 · Secondary #D4AF37 · Background #FFFBF0 · Text #1A1A1A · Accent #F3E5B5
// Keep in sync with AdminShell, AdminDashboard and the storefront components.
const PRIMARY = '#A67C00';
const SECONDARY = '#D4AF37';
const BG = '#FFFBF0';
const INK = '#1A1A1A';
const INK_SOFT = 'rgba(26, 26, 26, 0.6)';
const LINE = '#EADFC0'; // soft gold border, derived from the accent

export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok) {
      router.push('/admin');
      router.refresh();
    } else {
      toast.error(data.error || 'Login failed');
    }
  }

  return (
    // fixed + inset-0 + high z-index: covers the whole screen, so the admin sidebar behind it is hidden
    <div
      className="fixed inset-0 z-[100] overflow-auto flex items-center justify-center px-4"
      style={{ background: BG }}
    >
      <form onSubmit={submit} className="w-full max-w-[340px]">
        <div className="text-center mb-8">
          <h1 className="text-xl font-medium" style={{ color: INK }}>
            SS Trendy Shopee
          </h1>
          <p className="text-xs mt-1.5" style={{ color: INK_SOFT }}>Admin sign in</p>
        </div>

        <div className="space-y-3">
          <input
            type="email"
            required
            placeholder="Admin email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2.5 text-sm outline-none transition-colors"
            style={{ background: '#FFFFFF', border: `1px solid ${LINE}`, borderRadius: '4px', color: INK }}
            onFocus={(e) => (e.target.style.borderColor = PRIMARY)}
            onBlur={(e) => (e.target.style.borderColor = LINE)}
          />
          <input
            type="password"
            required
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2.5 text-sm outline-none transition-colors"
            style={{ background: '#FFFFFF', border: `1px solid ${LINE}`, borderRadius: '4px', color: INK }}
            onFocus={(e) => (e.target.style.borderColor = PRIMARY)}
            onBlur={(e) => (e.target.style.borderColor = LINE)}
          />
        </div>

        <button
          disabled={loading}
          className="w-full mt-5 py-2.5 text-sm font-medium transition-opacity active:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: PRIMARY, color: '#FFFFFF', border: `1px solid ${PRIMARY}`, borderRadius: '4px' }}
        >
          {loading ? 'Signing in…' : 'Sign In'}
        </button>
      </form>
    </div>
  );
}