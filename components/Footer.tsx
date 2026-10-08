import { Leaf, Mail, Phone } from 'lucide-react';
import Link from 'next/link';

/**
 * Contact details render only when configured (SUPPORT_EMAIL, SUPPORT_PHONE
 * in the deployment's environment) — a placeholder number on a live site is
 * worse than none.
 */
export function Footer() {
  const email = process.env.SUPPORT_EMAIL;
  const phone = process.env.SUPPORT_PHONE;
  return (
    <footer className="bg-card border-t border-border mt-20">
      <div>
        <div className="container mx-auto px-4 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Leaf className="h-6 w-6 text-primary" />
                <span className="font-heading text-lg font-bold text-foreground">AgriConnect</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Zimbabwe's farm-to-market marketplace. Connecting farmers directly with buyers.
              </p>
            </div>
            <div>
              <h2 className="font-heading font-semibold mb-3 text-foreground">For Buyers</h2>
              <div className="space-y-2 text-sm text-muted-foreground">
                <Link href="/browse" className="block hover:text-foreground transition-colors">Browse Produce</Link>
                <Link href="/prices" className="block hover:text-foreground transition-colors">Market Prices</Link>
                <Link href="/register" className="block hover:text-foreground transition-colors">Create Account</Link>
              </div>
            </div>
            <div>
              <h2 className="font-heading font-semibold mb-3 text-foreground">For Farmers</h2>
              <div className="space-y-2 text-sm text-muted-foreground">
                <Link href="/register?role=farmer" className="block hover:text-foreground transition-colors">Register Your Farm</Link>
                <Link href="/login" className="block hover:text-foreground transition-colors">Sign in</Link>
              </div>
            </div>
            <div>
              <h2 className="font-heading font-semibold mb-3 text-foreground">Account</h2>
              <div className="space-y-2 text-sm text-muted-foreground">
                <Link href="/forgot-password" className="block hover:text-foreground transition-colors">Forgot password</Link>
                <Link href="/settings/security" className="block hover:text-foreground transition-colors">Account security</Link>
                {phone && (
                  <a href={`tel:${phone.replace(/\s/g, '')}`} className="flex items-center gap-2 hover:text-foreground transition-colors">
                    <Phone className="h-4 w-4 shrink-0" aria-hidden /> {phone}
                  </a>
                )}
                {email && (
                  <a href={`mailto:${email}`} className="flex items-center gap-2 hover:text-foreground transition-colors">
                    <Mail className="h-4 w-4 shrink-0" aria-hidden /> {email}
                  </a>
                )}
              </div>
            </div>
          </div>
          <div className="border-t border-border mt-8 pt-6 text-center text-sm text-muted-foreground">
            © {new Date().getFullYear()} AgriConnect. All rights reserved. Made in Zimbabwe.
          </div>
        </div>
      </div>
    </footer>
  );
}
