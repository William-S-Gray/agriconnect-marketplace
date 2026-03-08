import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Farmer, Buyer, CartItem } from '@/lib/mock-data';
import { mockFarmers } from '@/lib/mock-data';

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
        if (role === 'farmer') {
          const farmer = mockFarmers.find(f => f.email === email);
          if (farmer) {
            set({ role: 'farmer', farmer, buyer: null, isAuthenticated: true });
            return true;
          }
          return false;
        }
        if (role === 'buyer') {
          set({
            role: 'buyer',
            buyer: { id: 'b1', name: 'Kudakwashe Moyo', phone: '0771000000', email, buyer_type: 'INDIVIDUAL', city: 'Harare', status: 'ACTIVE' },
            farmer: null,
            isAuthenticated: true,
          });
          return true;
        }
        if (role === 'admin') {
          // Simple admin check — in production this would be server-side
          if (email === 'admin@agriconnect.co.zw') {
            set({ role: 'admin', farmer: null, buyer: null, isAuthenticated: true });
            return true;
          }
          return false;
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

// Backward-compatible hooks
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
