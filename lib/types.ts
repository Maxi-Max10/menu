export type Plan = "basic" | "premium";
export type VenueType = "Restaurante" | "Cafetería" | "Bar" | "Otro";
export type Palette = "oliva" | "terracota" | "oceano" | "ciruela" | "carbon";

export const PLANS: Record<Plan, { label: string; price: number; limit: number }> = {
  basic: { label: "Esencial", price: 10000, limit: 100 },
  premium: { label: "Premium", price: 18000, limit: 200 },
};

export const PALETTES: Record<Palette, { label: string; primary: string; accent: string }> = {
  oliva: { label: "Oliva", primary: "#244638", accent: "#dfb66e" },
  terracota: { label: "Terracota", primary: "#9a4838", accent: "#e7b17d" },
  oceano: { label: "Océano", primary: "#1e5771", accent: "#80c7ca" },
  ciruela: { label: "Ciruela", primary: "#5a3c64", accent: "#daa7bb" },
  carbon: { label: "Carbón", primary: "#282b2b", accent: "#d9b582" },
};

export type Restaurant = {
  id: string;
  name: string;
  slug: string;
  type: VenueType;
  plan: Plan;
  palette: Palette;
  logo_data: string | null;
  description: string;
  address: string;
  instagram: string;
  whatsapp: string;
  orders_enabled: boolean;
  is_enabled: boolean;
  signup_status: "pending" | "active";
  paid_until: string | null;
  is_trial?: boolean;
  created_at: string;
  product_count?: number;
  owner_email?: string;
};

export type Product = {
  id: string;
  restaurant_id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image_data: string | null;
  model_url: string | null;
  featured: boolean;
  promo_price: number | null;
  available: boolean;
  created_at: string;
};

export function menuIsActive(restaurant: Pick<Restaurant, "is_enabled" | "paid_until">) {
  return restaurant.is_enabled && !!restaurant.paid_until && new Date(restaurant.paid_until).getTime() >= Date.now();
}

export function formatMoney(amount: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(amount);
}

export function sellingPrice(product: Pick<Product, "price" | "promo_price">) {
  return product.promo_price !== null && product.promo_price < product.price ? product.promo_price : product.price;
}
