import './globals.css';
import { Playfair_Display, Poppins } from 'next/font/google';
import { Toaster } from 'react-hot-toast';
import { CartProvider } from '@/components/CartContext';
import { WishlistProvider } from '@/components/WhishlistContext';
// import BottomNav from '@/components/BottomNav';
import { dbConnect } from '@/lib/mongodb';
import Settings from '@/models/Settings';

const display = Playfair_Display({ subsets: ['latin'], variable: '--font-display', weight: ['600', '700', '800'] });
const body = Poppins({ subsets: ['latin'], variable: '--font-body', weight: ['300', '400', '500', '600', '700'] });

// Fallback only. Set NEXT_PUBLIC_SITE_URL in .env to your real domain.
const DEFAULT_SITE_URL = 'https://sstrendyshopee.com';

// Always returns a valid absolute URL object, even if the env var
// is missing the protocol (e.g. "sstrendyshopee.com" or "localhost:3000").
function getSiteUrl() {
  const raw = (process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL).trim();
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    return new URL(withProtocol);
  } catch {
    return new URL(DEFAULT_SITE_URL);
  }
}

export async function generateMetadata() {
  let settings = null;
  try {
    await dbConnect();
    settings = await Settings.findOne({ key: 'global' });
  } catch {
    settings = null;
  }

  const title = settings?.seoTitle || 'SS Trendy Shopee - Handmades & Frocks';
  const description =
    settings?.seoDescription ||
    'Shop beautiful handmade products and trendy frocks online from SS Trendy Shopee, Salem.';

  return {
    title: { default: title, template: '%s | SS Trendy Shopee' },
    description,
    metadataBase: getSiteUrl(),
    keywords: ['handmade products online', 'frocks online', 'SS Trendy Shopee', 'handmade gifts', 'Salem'],
    openGraph: { title, description, siteName: 'SS Trendy Shopee', type: 'website' },
    icons: { icon: '/favicon.ico' },
  };
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        className={`${display.variable} ${body.variable} font-body antialiased`}
        style={{ background: '#FFFBF0' }}
      >
        <CartProvider>
          <WishlistProvider>
            {children}

            {/* spacer so page content isn't hidden behind the fixed mobile nav */}
            <div className="md:hidden h-16" />

            {/* <BottomNav /> */}
          </WishlistProvider>
        </CartProvider>

        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              fontFamily: 'var(--font-body)',
              background: '#fff',
              color: '#1A1A1A',
              border: '1.5px solid #D4AF37',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '600',
            },
            success: {
              iconTheme: {
                primary: '#A67C00',
                secondary: '#fff',
              },
            },
            error: {
              iconTheme: {
                primary: '#D4AF37',
                secondary: '#fff',
              },
            },
          }}
        />
      </body>
    </html>
  );
}