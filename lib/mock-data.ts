export interface Farmer {
  id: string;
  name: string;
  farm_name: string;
  phone: string;
  email: string;
  province: string;
  district: string;
  gps_lat?: number;
  gps_lng?: number;
  farm_size_ha?: number;
  profile_photo?: string;
  status: 'PENDING' | 'VERIFIED' | 'SUSPENDED';
  rating: number;
  total_reviews: number;
  total_sales: number;
  ecocash_number: string;
}

export interface Buyer {
  id: string;
  name: string;
  phone: string;
  email: string;
  buyer_type: 'INDIVIDUAL' | 'RESTAURANT' | 'RETAILER' | 'PROCESSOR' | 'EXPORTER';
  city: string;
  address?: string;
  ecocash_number?: string;
  status: string;
}

export interface ProduceListing {
  id: string;
  farmer_id: string;
  title: string;
  description?: string;
  category: string;
  produce_type: string;
  quantity_kg: number;
  quantity_unit: string;
  price_per_unit: number;
  currency: string;
  min_order_qty: number;
  harvest_date?: string;
  available_from: string;
  available_until?: string;
  photos: string[];
  is_organic: boolean;
  is_available: boolean;
  province: string;
  district: string;
  delivery_options: string[];
  views_count: number;
  status: 'ACTIVE' | 'SOLD_OUT' | 'EXPIRED' | 'REMOVED';
  created_at: string;
}

export interface Order {
  id: string;
  buyer_id: string;
  farmer_id: string;
  listing_id: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  platform_fee: number;
  farmer_payout: number;
  currency: string;
  delivery_method: 'PICKUP' | 'DELIVERY';
  delivery_address?: string;
  delivery_date?: string;
  status: 'PENDING' | 'CONFIRMED' | 'IN_TRANSIT' | 'DELIVERED' | 'COMPLETED' | 'DISPUTED' | 'CANCELLED' | 'REFUNDED';
  payment_status: 'UNPAID' | 'PAID' | 'HELD_ESCROW' | 'RELEASED' | 'REFUNDED';
  buyer_confirmed: boolean;
  notes?: string;
  created_at: string;
  buyer_name?: string;
  produce_title?: string;
  farmer_name?: string;
}

export interface Review {
  id: string;
  order_id: string;
  farmer_id: string;
  buyer_id: string;
  rating: number;
  comment: string;
  created_at: string;
  buyer_name?: string;
  buyer_city?: string;
}

export interface PriceHistory {
  id: string;
  produce_type: string;
  category: string;
  province: string;
  avg_price: number;
  min_price: number;
  max_price: number;
  listings_count: number;
  recorded_at: string;
}

export interface CartItem {
  listingId: string;
  title: string;
  farmerName: string;
  farmerId: string;
  pricePerUnit: number;
  quantity: number;
  unit: string;
  maxAvailable: number;
  photo?: string;
}

export interface Dispute {
  id: string;
  order_id: string;
  raised_by: 'BUYER' | 'FARMER';
  reason: string;
  description: string;
  status: 'OPEN' | 'INVESTIGATING' | 'RESOLVED_BUYER' | 'RESOLVED_FARMER' | 'CLOSED';
  resolution?: string;
  created_at: string;
  buyer_name?: string;
  farmer_name?: string;
  order_amount?: number;
}

export const PROVINCES = [
  'Harare', 'Bulawayo', 'Manicaland', 'Mashonaland Central',
  'Mashonaland East', 'Mashonaland West', 'Masvingo',
  'Matabeleland North', 'Matabeleland South', 'Midlands'
] as const;

export const CATEGORIES = [
  { name: 'Vegetables', emoji: '🥦', color: 'primary' },
  { name: 'Fruits', emoji: '🍎', color: 'warning' },
  { name: 'Grains', emoji: '🌽', color: 'accent' },
  { name: 'Legumes', emoji: '🫘', color: 'earth' },
  { name: 'Livestock', emoji: '🐄', color: 'earth' },
  { name: 'Dairy', emoji: '🥛', color: 'muted' },
  { name: 'Poultry', emoji: '🐔', color: 'warning' },
  { name: 'Herbs', emoji: '🌿', color: 'fresh' },
] as const;

export const UNITS = ['kg', 'tonne', 'crate', 'bundle', 'litre', 'dozen', 'head'] as const;

export const PLATFORM_FEE_PERCENT = 5;

export const calculateOrder = (quantity: number, pricePerUnit: number) => {
  const subtotal = quantity * pricePerUnit;
  const platformFee = subtotal * (PLATFORM_FEE_PERCENT / 100);
  const farmerPayout = subtotal - platformFee;
  return { subtotal, platformFee, farmerPayout, total: subtotal };
};
