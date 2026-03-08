import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Farmer, Buyer, CartItem } from '@/lib/mock-data';
import { mockFarmers } from '@/lib/mock-data';

interface FarmerAuthStore {
  farmer: Farmer | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
}

interface BuyerAuthStore {
  buyer: Buyer | null;
  isAuthenticated: boolean;
  cart: CartItem[];
  addToCart: (item: CartItem) => void;
  removeFromCart: (listingId: string) => void;
  updateCartQuantity: (listingId: string, quantity: number) => void;
  clearCart: () => void;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
}

export const useFarmerAuth = create<FarmerAuthStore>()(
  persist(
    (set) => ({
      farmer: null,
      isAuthenticated: false,
      login: async (email: string, _password: string) => {
        const farmer = mockFarmers.find(f => f.email === email);
        if (farmer) {
          set({ farmer, isAuthenticated: true });
          return true;
        }
        return false;
      },
      logout: () => set({ farmer: null, isAuthenticated: false }),
    }),
    { name: 'farmer-auth' }
  )
);

export const useBuyerAuth = create<BuyerAuthStore>()(
  persist(
    (set, get) => ({
      buyer: null,
      isAuthenticated: false,
      cart: [],
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
      login: async (email: string, _password: string) => {
        set({
          buyer: { id: 'b1', name: 'Kudakwashe Moyo', phone: '0771000000', email, buyer_type: 'INDIVIDUAL', city: 'Harare', status: 'ACTIVE' },
          isAuthenticated: true,
        });
        return true;
      },
      logout: () => set({ buyer: null, isAuthenticated: false, cart: [] }),
    }),
    { name: 'buyer-auth' }
  )
);
