import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Farmer, Buyer, CartItem } from '@/lib/mock-data';

export type UserRole = 'farmer' | 'buyer' | 'admin';

interface UnifiedAuthStore {
  role: UserRole | null;
  farmer: Farmer | null;
  buyer: Buyer | null;
  isAuthenticated: boolean;
  cart: CartItem[];
  login: (email: string, password: string, role: UserRole) => Promise<boolean>;
  logout: () => void;
  addToCart: (item: CartItem) => void;
  removeFromCart: (listingId: string) => void;
  updateCartQuantity: (listingId: string, quantity: number) => void;
  clearCart: () => void;
}

export const useAuth = create<UnifiedAuthStore>()(
  persist(
    (set, get) => ({
      role: null,
      farmer: null,
      buyer: null,
      isAuthenticated: false,
      cart: [],
      login: async (email: string, _password: string, role: UserRole) => {
        // TODO: Replace with real backend authentication
        if (role === 'farmer') {
          set({
            role: 'farmer',
            farmer: {
              id: crypto.randomUUID(),
              name: email.split('@')[0],
              farm_name: `${email.split('@')[0]}'s Farm`,
              phone: '',
              email,
              province: '',
              district: '',
              status: 'PENDING',
              rating: 0,
              total_reviews: 0,
              total_sales: 0,
              ecocash_number: '',
            },
            buyer: null,
            isAuthenticated: true,
          });
          return true;
        }
        if (role === 'buyer') {
          set({
            role: 'buyer',
            buyer: {
              id: crypto.randomUUID(),
              name: email.split('@')[0],
              phone: '',
              email,
              buyer_type: 'INDIVIDUAL',
              city: '',
              status: 'ACTIVE',
            },
            farmer: null,
            isAuthenticated: true,
          });
          return true;
        }
        if (role === 'admin') {
          set({ role: 'admin', farmer: null, buyer: null, isAuthenticated: true });
          return true;
        }
        return false;
      },
      logout: () => set({ role: null, farmer: null, buyer: null, isAuthenticated: false, cart: [] }),
      addToCart: (item) => {
        const existing = get().cart.find(c => c.listingId === item.listingId);
        if (existing) {
          set({ cart: get().cart.map(c => c.listingId === item.listingId ? { ...c, quantity: c.quantity + item.quantity } : c) });
        } else {
          set({ cart: [...get().cart, item] });
        }
      },
      removeFromCart: (listingId) => set({ cart: get().cart.filter(c => c.listingId !== listingId) }),
      updateCartQuantity: (listingId, quantity) =>
        set({ cart: get().cart.map(c => c.listingId === listingId ? { ...c, quantity } : c) }),
      clearCart: () => set({ cart: [] }),
    }),
    { name: 'agriconnect-auth' }
  )
);

export const useFarmerAuth = () => {
  const store = useAuth();
  return {
    farmer: store.farmer,
    isAuthenticated: store.role === 'farmer' && store.isAuthenticated,
    login: (email: string, password: string) => store.login(email, password, 'farmer'),
    logout: store.logout,
  };
};

export const useBuyerAuth = () => {
  const store = useAuth();
  return {
    buyer: store.buyer,
    isAuthenticated: store.role === 'buyer' && store.isAuthenticated,
    cart: store.cart,
    addToCart: store.addToCart,
    removeFromCart: store.removeFromCart,
    updateCartQuantity: store.updateCartQuantity,
    clearCart: store.clearCart,
    login: (email: string, password: string) => store.login(email, password, 'buyer'),
    logout: store.logout,
  };
};
