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
  // Joined fields
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

// Mock Farmers
export const mockFarmers: Farmer[] = [
  {
    id: 'f1', name: 'John Moyo', farm_name: "Moyo's Green Acres", phone: '0771234567',
    email: 'john@moyofarm.co.zw', province: 'Mashonaland East', district: 'Marondera',
    farm_size_ha: 12, status: 'VERIFIED', rating: 4.6, total_reviews: 18,
    total_sales: 3200, ecocash_number: '0771234567',
  },
  {
    id: 'f2', name: 'Tendai Chirwa', farm_name: 'Sunrise Farms', phone: '0772345678',
    email: 'tendai@sunrise.co.zw', province: 'Mashonaland West', district: 'Chinhoyi',
    farm_size_ha: 8, status: 'VERIFIED', rating: 4.2, total_reviews: 12,
    total_sales: 1800, ecocash_number: '0772345678',
  },
  {
    id: 'f3', name: 'Grace Ndlovu', farm_name: 'Ndlovu Organic Farm', phone: '0773456789',
    email: 'grace@ndlovufarm.co.zw', province: 'Manicaland', district: 'Mutare',
    farm_size_ha: 5, status: 'VERIFIED', rating: 4.8, total_reviews: 24,
    total_sales: 4500, ecocash_number: '0773456789',
  },
  {
    id: 'f4', name: 'Blessing Chikore', farm_name: 'Harvest Valley', phone: '0774567890',
    email: 'blessing@harvestvalley.co.zw', province: 'Masvingo', district: 'Chiredzi',
    farm_size_ha: 20, status: 'PENDING', rating: 0, total_reviews: 0,
    total_sales: 0, ecocash_number: '0774567890',
  },
];

// Mock Listings
export const mockListings: ProduceListing[] = [
  {
    id: 'l1', farmer_id: 'f1', title: 'Roma Tomatoes — Chemical Free',
    description: 'Fresh roma tomatoes from our Marondera farm. Grown without chemicals, perfect for sauces and salads. Hand-picked at peak ripeness.',
    category: 'Vegetables', produce_type: 'Tomatoes', quantity_kg: 150, quantity_unit: 'kg',
    price_per_unit: 0.80, currency: 'USD', min_order_qty: 5, harvest_date: '2026-03-05',
    available_from: '2026-03-05', photos: [], is_organic: false, is_available: true,
    province: 'Mashonaland East', district: 'Marondera', delivery_options: ['PICKUP', 'DELIVERY'],
    views_count: 87, status: 'ACTIVE', created_at: '2026-03-05',
  },
  {
    id: 'l2', farmer_id: 'f2', title: 'Premium Butternuts — Large Size',
    description: 'Sweet, creamy butternuts averaging 2kg each. Excellent for soups and roasting. Bulk orders welcome.',
    category: 'Vegetables', produce_type: 'Butternuts', quantity_kg: 200, quantity_unit: 'kg',
    price_per_unit: 1.20, currency: 'USD', min_order_qty: 10, harvest_date: '2026-03-02',
    available_from: '2026-03-02', photos: [], is_organic: false, is_available: true,
    province: 'Mashonaland West', district: 'Chinhoyi', delivery_options: ['PICKUP'],
    views_count: 54, status: 'ACTIVE', created_at: '2026-03-02',
  },
  {
    id: 'l3', farmer_id: 'f1', title: 'White Maize — Grade A',
    description: 'Top grade white maize, properly dried to 12% moisture. Suitable for milling.',
    category: 'Grains', produce_type: 'Maize', quantity_kg: 2000, quantity_unit: 'tonne',
    price_per_unit: 0.45, currency: 'USD', min_order_qty: 100, harvest_date: '2026-02-20',
    available_from: '2026-02-20', photos: [], is_organic: false, is_available: true,
    province: 'Mashonaland East', district: 'Marondera', delivery_options: ['PICKUP', 'DELIVERY'],
    views_count: 132, status: 'ACTIVE', created_at: '2026-02-20',
  },
  {
    id: 'l4', farmer_id: 'f3', title: 'Organic Spinach — Fresh Daily',
    description: 'Certified organic spinach, harvested fresh every morning. Rich, dark leaves with exceptional flavor.',
    category: 'Vegetables', produce_type: 'Spinach', quantity_kg: 30, quantity_unit: 'bundle',
    price_per_unit: 0.40, currency: 'USD', min_order_qty: 2, harvest_date: '2026-03-08',
    available_from: '2026-03-08', photos: [], is_organic: true, is_available: true,
    province: 'Manicaland', district: 'Mutare', delivery_options: ['PICKUP'],
    views_count: 45, status: 'ACTIVE', created_at: '2026-03-08',
  },
  {
    id: 'l5', farmer_id: 'f3', title: 'Sweet Potatoes — Orange Flesh',
    description: 'Nutritious orange-fleshed sweet potatoes. Rich in Vitamin A. Great for families.',
    category: 'Vegetables', produce_type: 'Sweet Potatoes', quantity_kg: 100, quantity_unit: 'kg',
    price_per_unit: 0.60, currency: 'USD', min_order_qty: 5, harvest_date: '2026-03-01',
    available_from: '2026-03-01', photos: [], is_organic: true, is_available: true,
    province: 'Manicaland', district: 'Mutare', delivery_options: ['PICKUP', 'DELIVERY'],
    views_count: 67, status: 'ACTIVE', created_at: '2026-03-01',
  },
  {
    id: 'l6', farmer_id: 'f2', title: 'Green Beans — Export Quality',
    description: 'Fine green beans, export grade. Consistent size, vibrant color. Ideal for restaurants.',
    category: 'Vegetables', produce_type: 'Green Beans', quantity_kg: 80, quantity_unit: 'kg',
    price_per_unit: 1.50, currency: 'USD', min_order_qty: 5, harvest_date: '2026-03-06',
    available_from: '2026-03-06', photos: [], is_organic: false, is_available: true,
    province: 'Mashonaland West', district: 'Chinhoyi', delivery_options: ['PICKUP'],
    views_count: 38, status: 'ACTIVE', created_at: '2026-03-06',
  },
  {
    id: 'l7', farmer_id: 'f1', title: 'Papaya — Tree Ripened',
    description: 'Naturally ripened papayas, sweet and fragrant. Each fruit weighs 1-2 kg.',
    category: 'Fruits', produce_type: 'Papaya', quantity_kg: 60, quantity_unit: 'kg',
    price_per_unit: 0.80, currency: 'USD', min_order_qty: 3, harvest_date: '2026-03-07',
    available_from: '2026-03-07', photos: [], is_organic: false, is_available: true,
    province: 'Mashonaland East', district: 'Marondera', delivery_options: ['PICKUP'],
    views_count: 29, status: 'ACTIVE', created_at: '2026-03-07',
  },
  {
    id: 'l8', farmer_id: 'f3', title: 'Organic Groundnuts — Roasted',
    description: 'Organically grown groundnuts, freshly roasted. Perfect for snacking or cooking.',
    category: 'Legumes', produce_type: 'Groundnuts', quantity_kg: 50, quantity_unit: 'kg',
    price_per_unit: 2.00, currency: 'USD', min_order_qty: 1, harvest_date: '2026-02-15',
    available_from: '2026-02-15', photos: [], is_organic: true, is_available: true,
    province: 'Manicaland', district: 'Mutare', delivery_options: ['PICKUP', 'DELIVERY'],
    views_count: 91, status: 'ACTIVE', created_at: '2026-02-15',
  },
];

export const mockOrders: Order[] = [
  {
    id: 'o1', buyer_id: 'b1', farmer_id: 'f1', listing_id: 'l1',
    quantity: 50, unit_price: 0.80, total_amount: 40, platform_fee: 2, farmer_payout: 38,
    currency: 'USD', delivery_method: 'PICKUP', status: 'PENDING', payment_status: 'UNPAID',
    buyer_confirmed: false, created_at: '2026-03-07',
    buyer_name: 'Kudakwashe Moyo', produce_title: 'Roma Tomatoes — Chemical Free',
  },
  {
    id: 'o2', buyer_id: 'b2', farmer_id: 'f2', listing_id: 'l2',
    quantity: 200, unit_price: 1.20, total_amount: 240, platform_fee: 12, farmer_payout: 228,
    currency: 'USD', delivery_method: 'PICKUP', status: 'CONFIRMED', payment_status: 'HELD_ESCROW',
    buyer_confirmed: false, created_at: '2026-03-05',
    buyer_name: 'FoodCo Restaurant', produce_title: 'Premium Butternuts — Large Size',
  },
  {
    id: 'o3', buyer_id: 'b1', farmer_id: 'f3', listing_id: 'l4',
    quantity: 10, unit_price: 0.40, total_amount: 4, platform_fee: 0.20, farmer_payout: 3.80,
    currency: 'USD', delivery_method: 'PICKUP', status: 'COMPLETED', payment_status: 'RELEASED',
    buyer_confirmed: true, created_at: '2026-02-28',
    buyer_name: 'Kudakwashe Moyo', produce_title: 'Organic Spinach — Fresh Daily',
  },
];

export const mockReviews: Review[] = [
  { id: 'r1', order_id: 'o3', farmer_id: 'f3', buyer_id: 'b1', rating: 5,
    comment: 'Fresh and well packaged. Will order again!', created_at: '2026-03-01',
    buyer_name: 'Kudakwashe', buyer_city: 'Harare' },
  { id: 'r2', order_id: 'o2', farmer_id: 'f1', buyer_id: 'b2', rating: 4,
    comment: 'Good quality tomatoes, slight delay in confirmation.', created_at: '2026-02-25',
    buyer_name: 'FoodCo', buyer_city: 'Bulawayo' },
  { id: 'r3', order_id: 'o1', farmer_id: 'f1', buyer_id: 'b1', rating: 5,
    comment: 'Excellent produce, very fresh.', created_at: '2026-02-20',
    buyer_name: 'Tatenda', buyer_city: 'Harare' },
];

export const mockPriceHistory: PriceHistory[] = [
  { id: 'p1', produce_type: 'Tomatoes', category: 'Vegetables', province: 'Mashonaland East', avg_price: 0.80, min_price: 0.50, max_price: 1.20, listings_count: 12, recorded_at: '2026-03-08' },
  { id: 'p2', produce_type: 'Butternuts', category: 'Vegetables', province: 'Mashonaland West', avg_price: 1.20, min_price: 0.90, max_price: 1.60, listings_count: 8, recorded_at: '2026-03-08' },
  { id: 'p3', produce_type: 'Maize', category: 'Grains', province: 'Multiple', avg_price: 0.45, min_price: 0.35, max_price: 0.55, listings_count: 24, recorded_at: '2026-03-08' },
  { id: 'p4', produce_type: 'Sweet Potatoes', category: 'Vegetables', province: 'Manicaland', avg_price: 0.60, min_price: 0.40, max_price: 0.80, listings_count: 6, recorded_at: '2026-03-08' },
  { id: 'p5', produce_type: 'Green Beans', category: 'Vegetables', province: 'Mashonaland East', avg_price: 1.50, min_price: 1.20, max_price: 2.00, listings_count: 5, recorded_at: '2026-03-08' },
  { id: 'p6', produce_type: 'Spinach', category: 'Vegetables', province: 'Harare', avg_price: 0.40, min_price: 0.25, max_price: 0.60, listings_count: 10, recorded_at: '2026-03-08' },
  { id: 'p7', produce_type: 'Papaya', category: 'Fruits', province: 'Masvingo', avg_price: 0.80, min_price: 0.60, max_price: 1.00, listings_count: 4, recorded_at: '2026-03-08' },
  { id: 'p8', produce_type: 'Bananas', category: 'Fruits', province: 'Manicaland', avg_price: 0.50, min_price: 0.30, max_price: 0.70, listings_count: 7, recorded_at: '2026-03-08' },
  { id: 'p9', produce_type: 'Groundnuts', category: 'Legumes', province: 'Midlands', avg_price: 2.00, min_price: 1.60, max_price: 2.50, listings_count: 9, recorded_at: '2026-03-08' },
  { id: 'p10', produce_type: 'Soya Beans', category: 'Legumes', province: 'Mashonaland West', avg_price: 0.90, min_price: 0.70, max_price: 1.10, listings_count: 11, recorded_at: '2026-03-08' },
];

export const getFarmerById = (id: string) => mockFarmers.find(f => f.id === id);
export const getListingById = (id: string) => mockListings.find(l => l.id === id);
export const getListingsByFarmer = (farmerId: string) => mockListings.filter(l => l.farmer_id === farmerId);
export const getReviewsByFarmer = (farmerId: string) => mockReviews.filter(r => r.farmer_id === farmerId);
export const getOrdersByFarmer = (farmerId: string) => mockOrders.filter(o => o.farmer_id === farmerId);
