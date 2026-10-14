import type { Product, Restaurant } from "@/lib/types";

export const demoRestaurant: Restaurant = {
  id: "demo",
  name: "Mesa Luma",
  slug: "demo",
  type: "Restaurante",
  plan: "premium",
  palette: "oliva",
  logo_data: null,
  description: "Cocina de todos los días, hecha para compartir.",
  address: "Palermo, Buenos Aires",
  instagram: "mesaluma_ejemplo",
  whatsapp: "",
  orders_enabled: true,
  is_enabled: true,
  paid_until: "2099-01-01",
  created_at: "2026-01-01",
};

export const demoProducts: Product[] = [
  { id: "1", restaurant_id: "demo", name: "Ensalada de estación", description: "Vegetales frescos, hojas verdes y aderezo de la casa.", price: 12000, category: "Para empezar", image_data: "/menu-examples/ensalada.webp", model_url: null, featured: true, promo_price: 9900, available: true, created_at: "" },
  { id: "2", restaurant_id: "demo", name: "Burrata de estación", description: "Tomates frescos, albahaca y aceite de oliva.", price: 14500, category: "Para empezar", image_data: "/menu-examples/burrata.webp", model_url: null, featured: false, promo_price: null, available: true, created_at: "" },
  { id: "3", restaurant_id: "demo", name: "Croquetas de hongos", description: "Crujientes por fuera, suaves por dentro. Alioli de limón.", price: 11000, category: "Para empezar", image_data: "/menu-examples/croquetas-hongos.webp", model_url: null, featured: false, promo_price: null, available: true, created_at: "" },
  { id: "4", restaurant_id: "demo", name: "Hamburguesa de la casa", description: "Carne a la plancha, queso, vegetales frescos y salsa especial.", price: 18500, category: "Principales", image_data: "/menu-examples/hamburguesa.webp", model_url: null, featured: true, promo_price: null, available: true, created_at: "" },
  { id: "5", restaurant_id: "demo", name: "Pasta al pesto", description: "Pasta fresca con pesto, tomates cherry y hojas verdes.", price: 18000, category: "Principales", image_data: "/menu-examples/pasta.webp", model_url: null, featured: false, promo_price: null, available: true, created_at: "" },
  { id: "6", restaurant_id: "demo", name: "Brochetas de la casa", description: "Brochetas a la parrilla para compartir.", price: 17000, category: "Principales", image_data: "/menu-examples/brochetas.webp", model_url: null, featured: false, promo_price: null, available: true, created_at: "" },
  { id: "7", restaurant_id: "demo", name: "Risotto de hongos", description: "Arroz cremoso, hongos salteados y parmesano.", price: 16500, category: "Principales", image_data: "/menu-examples/risotto-hongos.webp", model_url: null, featured: false, promo_price: null, available: true, created_at: "" },
  { id: "8", restaurant_id: "demo", name: "Limonada de menta", description: "Limonada casera, jengibre y menta fresca.", price: 5500, category: "Bebidas", image_data: "/menu-examples/limonada-menta.webp", model_url: null, featured: false, promo_price: null, available: true, created_at: "" },
  { id: "9", restaurant_id: "demo", name: "Torta de chocolate y frutillas", description: "Chocolate, frutillas frescas y crema para compartir.", price: 8500, category: "Postres", image_data: "/menu-examples/torta-frutillas.png", model_url: null, featured: false, promo_price: null, available: true, created_at: "" },
];
