import assert from "node:assert/strict";
import test from "node:test";
import { menuColors, priceOrder, readableTextOn } from "../lib/types.ts";
import { brandingSchema, orderInputSchema } from "../lib/validation.ts";

test("order checkout accepts an older open tab and validates current delivery details", () => {
  const base = {
    restaurantId: "11111111-1111-4111-8111-111111111111",
    customerName: "Ana Pérez", customerPhone: "+54 9 261 123-4567", notes: "Sin sal",
    items: [{ productId: "22222222-2222-4222-8222-222222222222", quantity: 1 }],
  };
  assert.equal(orderInputSchema.safeParse(base).success, true);
  assert.equal(orderInputSchema.safeParse({ ...base, checkoutVersion: 2 }).success, false);
  assert.equal(orderInputSchema.safeParse({ ...base, checkoutVersion: 2, deliveryMethod: "delivery", deliveryAddress: "", paymentMethod: "cash" }).success, false);
  assert.equal(orderInputSchema.safeParse({ ...base, checkoutVersion: 2, deliveryMethod: "delivery", deliveryAddress: "San Martín 123", paymentMethod: "cash" }).success, true);
  assert.equal(orderInputSchema.safeParse({ ...base, checkoutVersion: 2, deliveryMethod: "pickup", deliveryAddress: "", paymentMethod: "transfer" }).success, true);
});

test("order total uses current server product prices and promotions", () => {
  const products = [
    { id: "salad", name: "Ensalada", price: 12000, promo_price: 9900 },
    { id: "drink", name: "Limonada", price: 3000, promo_price: null },
  ];
  const result = priceOrder([{ productId: "salad", quantity: 2, price: 1 }, { productId: "drink", quantity: 1 }], products);
  assert.equal(result.total, 22800);
  assert.deepEqual(result.lines.map(({ unitPrice, lineTotal }) => ({ unitPrice, lineTotal })), [
    { unitPrice: 9900, lineTotal: 19800 },
    { unitPrice: 3000, lineTotal: 3000 },
  ]);
  assert.throws(() => priceOrder([{ productId: "removed", quantity: 1 }], products), /PRODUCT_UNAVAILABLE/);
});

test("custom menu colors apply only with valid hexadecimal values", () => {
  assert.deepEqual(menuColors({ palette: "personalizado", custom_primary: "#195273", custom_accent: "#E6A83B" }), {
    primary: "#195273", accent: "#E6A83B",
  });
  assert.equal(menuColors({ palette: "personalizado", custom_primary: "red", custom_accent: "#E6A83B" }).primary, "#244638");
  assert.equal(readableTextOn("#FFFFFF"), "#192820");
  assert.equal(readableTextOn("#244638"), "#ffffff");
  const identity = { name: "Café Nuevo", type: "Cafetería", palette: "personalizado", custom_primary: "#GGGGGG", custom_accent: "#E6A83B", logo_data: null, description: "", address: "", instagram: "", whatsapp: "", orders_enabled: true };
  assert.equal(brandingSchema.safeParse(identity).success, false);
  assert.equal(brandingSchema.safeParse({ ...identity, custom_primary: "#195273" }).success, true);
});
