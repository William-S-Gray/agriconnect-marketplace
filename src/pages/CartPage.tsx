import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Trash2, Minus, Plus, ShoppingCart } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { EcoCashModal } from '@/components/EcoCashModal';
import { useBuyerAuth } from '@/stores/auth-store';
import { calculateOrder } from '@/lib/mock-data';
import { toast } from 'sonner';

const PRODUCE_EMOJIS: Record<string, string> = {
  Tomatoes: '🍅', Maize: '🌽', Butternut: '🎃', Lettuce: '🥬', Onions: '🧅',
  Eggs: '🥚', Milk: '🥛', Peas: '🫛', default: '🥬',
};

function getEmoji(title: string): string {
  const found = Object.entries(PRODUCE_EMOJIS).find(([k]) => title.toLowerCase().includes(k.toLowerCase()));
  return found ? found[1] : PRODUCE_EMOJIS.default;
}

const CartPage = () => {
  const { cart, removeFromCart, updateCartQuantity, clearCart, isAuthenticated } = useBuyerAuth();
  const [ecocashOpen, setEcocashOpen] = useState(false);
  const navigate = useNavigate();

  const grandTotal = cart.reduce((s, c) => s + calculateOrder(c.quantity, c.pricePerUnit).total, 0);

  const handleSuccess = (orderRef: string) => {
    clearCart();
    setEcocashOpen(false);
    toast.success(`Order ${orderRef} placed! Payment held in escrow.`);
    navigate('/buyer/dashboard');
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <h1 className="font-heading text-2xl font-bold text-foreground mb-6">Your Cart</h1>

        {cart.length === 0 ? (
          <div className="text-center py-20">
            <div className="neo-card w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShoppingCart className="h-10 w-10 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground mb-4">Your cart is empty.</p>
            <Link to="/browse">
              <Button className="neo-btn bg-primary text-primary-foreground">Browse Produce</Button>
            </Link>
          </div>
        ) : (
          <>
            <div className="space-y-4 mb-8">
              {cart.map(item => {
                const order = calculateOrder(item.quantity, item.pricePerUnit);
                return (
                  <div key={item.listingId} className="neo-card p-4 flex items-center gap-4">
                    <div className="w-16 h-16 rounded-xl neo-inset flex items-center justify-center shrink-0 text-3xl">
                      {getEmoji(item.title)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-heading font-semibold text-foreground text-sm line-clamp-1">{item.title}</h3>
                      <p className="text-xs text-muted-foreground">{item.farmerName}</p>
                      <p className="price-display text-sm mt-1">${item.pricePerUnit.toFixed(2)} / {item.unit}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="icon" className="h-8 w-8 neo-flat border-none"
                        onClick={() => updateCartQuantity(item.listingId, Math.max(1, item.quantity - 1))}>
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="font-mono text-sm w-8 text-center text-foreground">{item.quantity}</span>
                      <Button variant="outline" size="icon" className="h-8 w-8 neo-flat border-none"
                        onClick={() => updateCartQuantity(item.listingId, Math.min(item.maxAvailable, item.quantity + 1))}>
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="text-right">
                      <p className="font-mono font-bold text-foreground">${order.total.toFixed(2)}</p>
                      <button onClick={() => removeFromCart(item.listingId)} className="text-destructive hover:text-destructive/80 mt-1 transition-colors">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="neo-card p-6">
              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal ({cart.length} item{cart.length !== 1 ? 's' : ''})</span>
                  <span className="font-mono text-foreground">${grandTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Platform fee (5% deducted from farmer payout — not added to your total)</span>
                </div>
                <div className="border-t border-border/50 pt-2 flex justify-between items-center">
                  <span className="font-semibold text-foreground">You Pay</span>
                  <span className="font-mono text-2xl font-bold text-accent">${grandTotal.toFixed(2)}</span>
                </div>
              </div>

              {isAuthenticated ? (
                <Button className="w-full btn-gold text-lg py-3 h-auto" onClick={() => setEcocashOpen(true)}>
                  📱 Pay with EcoCash
                </Button>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground text-center">Please login to checkout</p>
                  <Link to="/login">
                    <Button className="w-full neo-btn bg-primary text-primary-foreground">Login to Checkout</Button>
                  </Link>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <EcoCashModal
        open={ecocashOpen}
        onClose={() => setEcocashOpen(false)}
        amount={grandTotal}
        itemCount={cart.length}
        onSuccess={handleSuccess}
      />
    </div>
  );
};

export default CartPage;
