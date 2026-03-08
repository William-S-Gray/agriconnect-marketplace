import { Link, useNavigate } from 'react-router-dom';
import { Trash2, Minus, Plus, ShoppingCart } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { useBuyerAuth } from '@/stores/auth-store';
import { calculateOrder } from '@/lib/mock-data';

const CartPage = () => {
  const { cart, removeFromCart, updateCartQuantity, isAuthenticated } = useBuyerAuth();
  const navigate = useNavigate();

  const grandTotal = cart.reduce((s, c) => s + calculateOrder(c.quantity, c.pricePerUnit).total, 0);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <h1 className="font-heading text-2xl font-bold text-foreground mb-6">Your Cart</h1>

        {cart.length === 0 ? (
          <div className="text-center py-20">
            <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">Your cart is empty.</p>
            <Link to="/browse"><Button className="bg-primary text-primary-foreground">Browse Produce</Button></Link>
          </div>
        ) : (
          <>
            <div className="space-y-4 mb-8">
              {cart.map(item => {
                const order = calculateOrder(item.quantity, item.pricePerUnit);
                return (
                  <div key={item.listingId} className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
                    <div className="w-16 h-16 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-2xl">🥬</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-heading font-semibold text-foreground text-sm line-clamp-1">{item.title}</h3>
                      <p className="text-xs text-muted-foreground">{item.farmerName}</p>
                      <p className="price-display text-sm mt-1">${item.pricePerUnit.toFixed(2)} / {item.unit}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateCartQuantity(item.listingId, Math.max(1, item.quantity - 1))}>
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="font-mono text-sm w-8 text-center">{item.quantity}</span>
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateCartQuantity(item.listingId, Math.min(item.maxAvailable, item.quantity + 1))}>
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="text-right">
                      <p className="font-mono font-bold text-foreground">${order.total.toFixed(2)}</p>
                      <button onClick={() => removeFromCart(item.listingId)} className="text-destructive hover:text-destructive/80 mt-1">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="bg-card border border-border rounded-xl p-6">
              <div className="flex justify-between items-center mb-4">
                <span className="font-semibold text-foreground">Total</span>
                <span className="font-mono text-2xl font-bold text-accent">${grandTotal.toFixed(2)}</span>
              </div>
              <p className="text-xs text-muted-foreground mb-4">5% platform fee is deducted from farmer payout, not added to your total.</p>
              {isAuthenticated ? (
                <Button className="w-full btn-gold text-lg py-3 h-auto">Pay with EcoCash</Button>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground text-center">Please login to checkout</p>
                  <Link to="/buyer/login"><Button className="w-full bg-primary text-primary-foreground">Login to Checkout</Button></Link>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CartPage;
