import { Leaf } from 'lucide-react';
import { Link } from 'react-router-dom';

export function Footer() {
  return (
    <footer className="bg-primary-dark text-primary-foreground mt-20">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Leaf className="h-6 w-6" />
              <span className="font-heading text-lg font-bold">AgriConnect</span>
            </div>
            <p className="text-sm opacity-80">
              Zimbabwe's farm-to-market marketplace. Connecting farmers directly with buyers.
            </p>
          </div>
          <div>
            <h4 className="font-heading font-semibold mb-3">For Buyers</h4>
            <div className="space-y-2 text-sm opacity-80">
              <Link to="/browse" className="block hover:opacity-100">Browse Produce</Link>
              <Link to="/prices" className="block hover:opacity-100">Market Prices</Link>
              <Link to="/buyer/register" className="block hover:opacity-100">Create Account</Link>
            </div>
          </div>
          <div>
            <h4 className="font-heading font-semibold mb-3">For Farmers</h4>
            <div className="space-y-2 text-sm opacity-80">
              <Link to="/farmer/register" className="block hover:opacity-100">Register Your Farm</Link>
              <Link to="/farmer/login" className="block hover:opacity-100">Farmer Login</Link>
            </div>
          </div>
          <div>
            <h4 className="font-heading font-semibold mb-3">Support</h4>
            <div className="space-y-2 text-sm opacity-80">
              <p>📞 +263 242 000 000</p>
              <p>📧 support@agriconnect.co.zw</p>
              <p>EcoCash secured payments</p>
            </div>
          </div>
        </div>
        <div className="border-t border-primary/30 mt-8 pt-6 text-center text-sm opacity-60">
          © 2026 AgriConnect. All rights reserved. Made in Zimbabwe 🇿🇼
        </div>
      </div>
    </footer>
  );
}
