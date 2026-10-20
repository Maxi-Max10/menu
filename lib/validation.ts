import { z } from "zod";

export const imageSchema = z.string().max(450_000).regex(/^data:image\/(png|jpeg|webp);base64,/).nullable().optional();
export const passwordSchema = z.string().min(10, "Usá al menos 10 caracteres").max(72)
  .refine((value) => new TextEncoder().encode(value).length <= 72, "La contraseña no puede superar 72 bytes");
export const phoneSchema = z.string().trim().max(30)
  .regex(/^\+?[0-9][0-9 ()-]*$/, "Ingresá un número de teléfono válido")
  .refine((value) => { const digits = value.replace(/\D/g, "").length; return digits >= 8 && digits <= 15; }, "Ingresá entre 8 y 15 dígitos");
export const orderInputSchema = z.object({
  restaurantId: z.string().uuid(),
  customerName: z.string().trim().min(2).max(80),
  customerPhone: phoneSchema,
  checkoutVersion: z.literal(2).optional(),
  deliveryMethod: z.enum(["delivery", "pickup"]).optional(),
  deliveryAddress: z.string().trim().max(180).optional(),
  paymentMethod: z.enum(["cash", "transfer", "mercado_pago", "card"]).optional(),
  notes: z.string().trim().max(300),
  items: z.array(z.object({ productId: z.string().uuid(), quantity: z.number().int().min(1).max(20) })).min(1).max(200),
}).superRefine((data, context) => {
  if (new Set(data.items.map((item) => item.productId)).size !== data.items.length) {
    context.addIssue({ code: "custom", message: "Hay productos repetidos en el pedido", path: ["items"] });
  }
  const hasCheckoutDetails = data.checkoutVersion === 2 || data.deliveryMethod !== undefined
    || data.deliveryAddress !== undefined || data.paymentMethod !== undefined;
  if (!hasCheckoutDetails) return;
  if (!data.deliveryMethod) context.addIssue({ code: "custom", message: "Elegí delivery o retiro", path: ["deliveryMethod"] });
  if (!data.paymentMethod) context.addIssue({ code: "custom", message: "Elegí un medio de pago", path: ["paymentMethod"] });
  if (data.deliveryMethod === "delivery" && (!data.deliveryAddress || data.deliveryAddress.length < 5)) {
    context.addIssue({ code: "custom", message: "Ingresá una dirección para el delivery", path: ["deliveryAddress"] });
  }
});
export const restaurantCreateSchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(60),
  type: z.enum(["Restaurante", "Cafetería", "Bar", "Otro"]),
  plan: z.enum(["basic", "premium"]),
  email: z.string().email().max(254),
  password: passwordSchema,
});
export const brandingSchema = z.object({
  name: z.string().trim().min(2).max(80),
  type: z.enum(["Restaurante", "Cafetería", "Bar", "Otro"]),
  palette: z.enum(["oliva", "terracota", "oceano", "ciruela", "carbon", "personalizado"]),
  custom_primary: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Ingresá un color hexadecimal válido").nullable().optional().default(null),
  custom_accent: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Ingresá un color hexadecimal válido").nullable().optional().default(null),
  logo_data: imageSchema,
  description: z.string().trim().max(400),
  address: z.string().trim().max(180),
  instagram: z.string().trim().max(100),
  whatsapp: z.string().trim().max(40),
  orders_enabled: z.boolean(),
}).refine((data) => data.palette !== "personalizado" || (!!data.custom_primary && !!data.custom_accent), {
  message: "Elegí dos colores personalizados",
  path: ["custom_primary"],
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
