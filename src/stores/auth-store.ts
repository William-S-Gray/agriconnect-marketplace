import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Farmer, Buyer, CartItem } from '@/lib/mock-data';
import { verifyFarmer, verifyBuyer, verifyAdmin } from '@/lib/demo-credentials';
import {
  startSession,
  verifySession,
  requiresSessionTermination,
  resetSessionAnomalyState,
  type SessionFingerprint,
} from '@/lib/session-anomaly';

export type UserRole = 'farmer' | 'buyer' | 'admin';

// Bumped to 4: sessions from v3 carry no anomaly-detection fingerprint, and
// restoring one would look indistinguishable from a fabricated session.
const STORE_VERSION = 4;

interface UnifiedAuthStore {
  _version: number;
  role: UserRole | null;
  farmer: Farmer | null;
  buyer: Buyer | null;
  isAuthenticated: boolean;
  /** Signed fingerprint for the active session; see lib/session-anomaly. */
  session: SessionFingerprint | null;
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
      _version: STORE_VERSION,
      role: null,
      farmer: null,
      buyer: null,
      isAuthenticated: false,
      session: null,
      cart: [],

      login: async (email: string, password: string, role: UserRole) => {
        if (!email || !password) return false;

        if (role === 'farmer') {
          const farmerProfile = verifyFarmer(email, password);
          if (!farmerProfile) return false;
          set({
            role: 'farmer', farmer: farmerProfile, buyer: null, isAuthenticated: true,
            session: startSession('farmer', farmerProfile.id),
          });
          return true;
        }

        if (role === 'buyer') {
          const buyerProfile = verifyBuyer(email, password);
          if (!buyerProfile) return false;
          set({
            role: 'buyer', buyer: buyerProfile, farmer: null, isAuthenticated: true,
            session: startSession('buyer', buyerProfile.id),
          });
          return true;
        }

        if (role === 'admin') {
          if (!verifyAdmin(email, password)) return false;
          set({
            role: 'admin', farmer: null, buyer: null, isAuthenticated: true,
            session: startSession('admin', email.trim().toLowerCase()),
          });
          return true;
        }

        return false;
      },

      logout: () => {
        resetSessionAnomalyState();
        set({ role: null, farmer: null, buyer: null, isAuthenticated: false, session: null, cart: [] });
      },

      addToCart: (item) => {
        const existing = get().cart.find(c => c.listingId === item.listingId);
        if (existing) {
          set({ cart: get().cart.map(c => c.listingId === item.listingId ? { ...c, quantity: Math.min(c.maxAvailable, c.quantity + item.quantity) } : c) });
        } else {
          set({ cart: [...get().cart, item] });
        }
      },
      removeFromCart: (listingId) => set({ cart: get().cart.filter(c => c.listingId !== listingId) }),
      updateCartQuantity: (listingId, quantity) => set({ cart: get().cart.map(c => c.listingId === listingId ? { ...c, quantity } : c) }),
      clearCart: () => set({ cart: [] }),
    }),
    {
      name: 'agriconnect-auth-v2',
      onRehydrateStorage: () => (state) => {
        if (!state) return;

        const clearSession = () => Object.assign(state, {
          role: null, farmer: null, buyer: null, isAuthenticated: false, session: null,
        });

        if (state._version !== STORE_VERSION) {
          clearSession();
          Object.assign(state, { cart: [], _version: STORE_VERSION });
          return;
        }

        // Restoring a session is the moment tampering becomes visible: the
        // persisted role is compared against the signed fingerprint, and a
        // critical finding ends the session before any protected route renders.
        if (state.isAuthenticated || state.role) {
          const anomalies = verifySession(state.session, state.role);
          if (requiresSessionTermination(anomalies)) {
            clearSession();
            // Mutating the rehydrated draft only fixes the in-memory store and
            // leaves the tampered copy on disk. Push a real update so persist
            // writes the cleared session through to storage.
            queueMicrotask(() => {
              useAuth.setState({
                role: null, farmer: null, buyer: null, isAuthenticated: false, session: null,
              });
            });
          }
        }
      },
    }
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
