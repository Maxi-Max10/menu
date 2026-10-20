export type Plan = "basic" | "premium";
export type VenueType = "Restaurante" | "Cafetería" | "Bar" | "Otro";
export type PresetPalette = "oliva" | "terracota" | "oceano" | "ciruela" | "carbon";
export type Palette = PresetPalette | "personalizado";

export const PLANS: Record<Plan, { label: string; price: number; limit: number }> = {
  basic: { label: "Esencial", price: 10000, limit: 100 },
  premium: { label: "Premium", price: 18000, limit: 200 },
};

export const PALETTES: Record<PresetPalette, { label: string; primary: string; accent: string }> = {
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
  custom_primary: string | null;
  custom_accent: string | null;
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
  owner_phone?: string | null;
  billing_notice_sent_at?: string | null;
};

export function isHexColor(value: string | null | undefined): value is string {
  return /^#[0-9a-fA-F]{6}$/.test(value || "");
}

export function menuColors(restaurant: Pick<Restaurant, "palette" | "custom_primary" | "custom_accent">) {
  const preset = restaurant.palette === "personalizado" ? PALETTES.oliva : PALETTES[restaurant.palette] || PALETTES.oliva;
  return restaurant.palette === "personalizado" && isHexColor(restaurant.custom_primary) && isHexColor(restaurant.custom_accent)
    ? { primary: restaurant.custom_primary, accent: restaurant.custom_accent }
    : preset;
}

export function readableTextOn(hex: string) {
  const channels = [1, 3, 5].map((start) => {
    const value = parseInt(hex.slice(start, start + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const luminance = channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  return luminance > 0.179 ? "#192820" : "#ffffff";
}

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

export type OrderStatus = "new" | "preparing" | "ready" | "completed" | "canceled";
export type DeliveryMethod = "delivery" | "pickup";
export type PaymentMethod = "cash" | "transfer" | "mercado_pago" | "card";
export const DELIVERY_LABELS: Record<DeliveryMethod, string> = { delivery: "Delivery", pickup: "Retiro en el local" };
export const PAYMENT_LABELS: Record<PaymentMethod, string> = { cash: "Efectivo", transfer: "Transferencia", mercado_pago: "Mercado Pago", card: "Tarjeta" };
export type OrderItem = { product_id: string | null; product_name: string; unit_price: number; quantity: number; line_total: number };
export type Order = {
  id: string;
  restaurant_id: string;
  customer_name: string;
  customer_phone: string;
  delivery_method: DeliveryMethod | null;
  delivery_address: string | null;
  payment_method: PaymentMethod | null;
  notes: string;
  total: number;
  status: OrderStatus;
  created_at: string;
  items: OrderItem[];
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

export function priceOrder(items: { productId: string; quantity: number }[], products: Pick<Product, "id" | "name" | "price" | "promo_price">[]) {
  if (products.length !== items.length) throw new Error("PRODUCT_UNAVAILABLE");
  const byId = new Map(products.map((product) => [product.id, product]));
  const lines = items.map((item) => {
    const product = byId.get(item.productId);
    if (!product) throw new Error("PRODUCT_UNAVAILABLE");
    const unitPrice = sellingPrice(product);
    return { product, quantity: item.quantity, unitPrice, lineTotal: unitPrice * item.quantity };
  });
  return { lines, total: lines.reduce((sum, line) => sum + line.lineTotal, 0) };
}
