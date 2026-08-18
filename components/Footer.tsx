import { Leaf } from 'lucide-react';
import Link from 'next/link';

export function Footer() {
  return (
    <footer className="bg-card mt-20">
      <div className="neo-flat mx-0 rounded-none">
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
              <h4 className="font-heading font-semibold mb-3 text-foreground">For Buyers</h4>
              <div className="space-y-2 text-sm text-muted-foreground">
                <Link href="/browse" className="block hover:text-foreground transition-colors">Browse Produce</Link>
                <Link href="/prices" className="block hover:text-foreground transition-colors">Market Prices</Link>
                <Link href="/buyer/register" className="block hover:text-foreground transition-colors">Create Account</Link>
              </div>
            </div>
            <div>
              <h4 className="font-heading font-semibold mb-3 text-foreground">For Farmers</h4>
              <div className="space-y-2 text-sm text-muted-foreground">
                <Link href="/farmer/register" className="block hover:text-foreground transition-colors">Register Your Farm</Link>
                <Link href="/login" className="block hover:text-foreground transition-colors">Login</Link>
              </div>
            </div>
            <div>
              <h4 className="font-heading font-semibold mb-3 text-foreground">Support</h4>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>📞 +263 242 000 000</p>
                <p>📧 support@agriconnect.co.zw</p>
                <p>EcoCash secured payments</p>
              </div>
            </div>
          </div>
          <div className="border-t border-border mt-8 pt-6 text-center text-sm text-muted-foreground">
            © 2026 AgriConnect. All rights reserved. Made in Zimbabwe 🇿🇼
          </div>
        </div>
      </div>
    </footer>
  );
}
