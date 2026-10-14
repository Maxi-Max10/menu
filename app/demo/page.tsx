import { MenuView } from "@/components/MenuView";
import type { Product, Restaurant } from "@/lib/types";

const restaurant: Restaurant = { id: "demo", name: "Casa Oliva", slug: "demo", type: "Restaurante", plan: "premium", palette: "oliva", logo_data: null, description: "Cocina de todos los días, hecha para compartir.", address: "Palermo, Buenos Aires", instagram: "casaoliva", whatsapp: "", is_enabled: true, paid_until: "2099-01-01", created_at: "2026-01-01" };
const products: Product[] = [
  { id: "1", restaurant_id: "demo", name: "Burrata de estación", description: "Tomates frescos, albahaca y aceite de oliva.", price: 14500, category: "Para empezar", image_data: null, model_url: null, available: true, created_at: "" },
  { id: "2", restaurant_id: "demo", name: "Croquetas de hongos", description: "Crujientes por fuera, suaves por dentro. Alioli de limón.", price: 11000, category: "Para empezar", image_data: null, model_url: null, available: true, created_at: "" },
  { id: "3", restaurant_id: "demo", name: "Risotto de hongos", description: "Arroz cremoso, hongos salteados y parmesano.", price: 16500, category: "Principales", image_data: null, model_url: null, available: true, created_at: "" },
  { id: "4", restaurant_id: "demo", name: "Pasta de la casa", description: "Pasta fresca con salsa de tomates asados y hierbas.", price: 18000, category: "Principales", image_data: null, model_url: null, available: true, created_at: "" },
  { id: "5", restaurant_id: "demo", name: "Limonada de menta", description: "Limonada casera, jengibre y menta fresca.", price: 5500, category: "Bebidas", image_data: null, model_url: null, available: true, created_at: "" },
  { id: "6", restaurant_id: "demo", name: "Tiramisú", description: "Café, mascarpone y cacao amargo.", price: 8500, category: "Postres", image_data: null, model_url: null, available: true, created_at: "" },
];

export default function Demo() { return <MenuView restaurant={restaurant} products={products} demo />; }
