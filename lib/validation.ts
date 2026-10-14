import { z } from "zod";

export const imageSchema = z.string().max(450_000).regex(/^data:image\/(png|jpeg|webp);base64,/).nullable().optional();
export const restaurantCreateSchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(60),
  type: z.enum(["Restaurante", "Cafetería", "Bar", "Otro"]),
  plan: z.enum(["basic", "premium"]),
  email: z.string().email().max(254),
  password: z.string().min(10).max(128),
});
export const brandingSchema = z.object({
  name: z.string().trim().min(2).max(80),
  type: z.enum(["Restaurante", "Cafetería", "Bar", "Otro"]),
  palette: z.enum(["oliva", "terracota", "oceano", "ciruela", "carbon"]),
  logo_data: imageSchema,
  description: z.string().trim().max(400),
  address: z.string().trim().max(180),
  instagram: z.string().trim().max(100),
  whatsapp: z.string().trim().max(40),
  orders_enabled: z.boolean(),
});
export const productSchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(500),
  price: z.number().int().min(0).max(100_000_000),
  category: z.string().trim().min(1).max(50),
  image_data: imageSchema,
  available: z.boolean(),
  featured: z.boolean(),
  promo_price: z.number().int().min(0).max(100_000_000).nullable(),
});
