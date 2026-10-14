import { expect, test, type Page } from "@playwright/test";

const logo = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200"><rect width="1200" height="1200" fill="#246e3f"/><path d="M600 200v800M200 600h800M317 317l566 566M883 317 317 883" stroke="white" stroke-width="110"/></svg>')}`;
const restaurant = {
  id: "browser-fixture", name: "Cafetería del Parque y Cocina de Encuentros", slug: "cafe-del-parque",
  type: "Cafetería", plan: "premium", palette: "oliva", logo_data: logo,
  description: "Café y sabores para compartir.", address: "Buenos Aires", instagram: "", whatsapp: "5491112345678", orders_enabled: true,
  is_enabled: true, paid_until: "2099-01-01", created_at: "2026-01-01",
};

async function expectNoPageOverflow(page: Page) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
}

test("menu logos and decoration stay within their containers", async ({ page }, testInfo) => {
  await page.goto("/demo");
  await expect(page.locator(".menu-cover-mark")).toHaveJSProperty("tagName", "svg");
  await expect(page.locator(".menu-cover-mark")).toHaveCSS("pointer-events", "none");
  await page.screenshot({ path: testInfo.outputPath("menu.png"), fullPage: true });

  await page.evaluate((src) => {
    const container = document.querySelector(".menu-logo")!;
    const image = new Image();
    image.alt = "Logo de prueba";
    image.src = src;
    container.replaceChildren(image);
    document.querySelector(".menu-cover h1")!.textContent = "Cafetería del Parque y Cocina de Encuentros";
    const photo = new Image();
    photo.alt = "Foto de prueba";
    photo.src = src;
    document.querySelector(".menu-product-art")!.replaceChildren(photo);
  }, logo);
  await expect.poll(() => page.locator(".menu-logo img").evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);

  const widths = testInfo.project.name === "iphone" || testInfo.project.name === "android" ? [320, 390, 844] : [320, 390, 768, 1440];
  for (const width of widths) {
    await page.setViewportSize({ width, height: width === 844 ? 390 : 900 });
    await expectNoPageOverflow(page);
    const dimensions = await page.evaluate(() => {
      const container = document.querySelector(".menu-logo")!.getBoundingClientRect();
      const image = document.querySelector(".menu-logo img")!.getBoundingClientRect();
      const art = document.querySelector(".menu-product-art")!.getBoundingClientRect();
      const photo = document.querySelector(".menu-product-art img")!.getBoundingClientRect();
      const copy = document.querySelector(".menu-cover-copy")!;
      return {
        logoWidth: container.width, imageWidth: image.width, imageHeight: image.height, logoHeight: container.height,
        artWidth: art.width, photoWidth: photo.width, artHeight: art.height, photoHeight: photo.height,
        copyOverflow: copy.scrollWidth - copy.clientWidth,
      };
    });
    expect(dimensions.logoWidth).toBeLessThanOrEqual(100);
    expect(dimensions.imageWidth).toBeLessThanOrEqual(dimensions.logoWidth);
    expect(dimensions.imageHeight).toBeLessThanOrEqual(dimensions.logoHeight);
    expect(dimensions.photoWidth).toBeLessThanOrEqual(dimensions.artWidth + 1);
    expect(dimensions.photoHeight).toBeLessThanOrEqual(dimensions.artHeight + 1);
    expect(dimensions.copyOverflow).toBeLessThanOrEqual(1);
  }
});

test("mobile menu search and categories remain usable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/demo");
  await expect(page.getByLabel("Buscar productos")).toHaveCSS("font-size", "16px");
  await page.getByRole("tab", { name: "Bebidas", exact: true }).click();
  await expect(page.locator(".menu-product")).toHaveCount(1);
  await expect(page.locator(".menu-product h3")).toHaveText("Limonada de menta");
  await page.getByLabel("Buscar productos").fill("sin-resultados");
  await expect(page.locator(".empty-products")).toBeVisible();
  await page.getByLabel("Buscar productos").fill("");
  await page.getByRole("tab", { name: "Todo", exact: true }).click();
  await expect(page.locator(".menu-product")).toHaveCount(9);
  await expectNoPageOverflow(page);
});

test("example Premium menu shows a promotion and builds a cart", async ({ page }) => {
  await page.goto("/demo");
  for (const dish of ["Ensalada de estación", "Hamburguesa de la casa", "Pasta al pesto", "Torta de chocolate y frutillas"]) {
    const photo = page.locator(".menu-product").filter({ has: page.getByRole("heading", { name: dish }) }).locator("img");
    await expect(photo).toBeVisible();
    await expect.poll(() => photo.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
  }

  const salad = page.locator(".menu-product").filter({ has: page.getByRole("heading", { name: "Ensalada de estación" }) });
  await expect(salad.getByText("Oferta")).toBeVisible();
  await expect(salad.locator(".menu-price s")).toHaveText(/12.000/);
  await salad.getByRole("button", { name: "Agregar" }).click();
  await page.getByRole("button", { name: "Ver pedido, 1 productos" }).click();
  const dialog = page.getByRole("dialog", { name: "Tu pedido" });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".cart-total strong")).toHaveText(/9.900/);
  await dialog.getByRole("button", { name: "Agregar Ensalada de estación" }).click();
  await expect(dialog.locator(".cart-total strong")).toHaveText(/19.800/);
  await expect(dialog.getByRole("button", { name: "Copiar pedido de ejemplo" })).toBeVisible();
  await dialog.getByRole("button", { name: "Cerrar pedido" }).click();
  await expect(dialog).toHaveCount(0);
});

test("mobile pages and restaurant forms fit the viewport", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.route("**/api/dashboard", route => route.fulfill({ json: { restaurant, products: [] } }));
  await page.route("**/api/admin/restaurants", route => route.fulfill({ json: { restaurants: [] } }));
  for (const path of ["/", "/ingresar", "/admin", "/panel"]) {
    await page.goto(path);
    await expect(page.getByRole("heading").first()).toBeVisible();
    await expectNoPageOverflow(page);
  }
  await page.getByRole("button", { name: "Nuevo producto" }).click();
  const price = page.getByLabel("Precio en ARS");
  await expect(price).toHaveValue("");
  await price.fill("200");
  await price.fill("");
  await expect(price).toHaveValue("");
  await price.fill("2500");
  await expect(price).toHaveValue("2500");
  await expect(price).toHaveCSS("font-size", "16px");
  await expectNoPageOverflow(page);
  const modal = await page.locator(".form-modal").boundingBox();
  expect(modal!.x).toBeGreaterThanOrEqual(0);
  expect(modal!.x + modal!.width).toBeLessThanOrEqual(375);
  await page.screenshot({ path: testInfo.outputPath("product-form.png") });
});

test("Premium owner can configure offers and see insights", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const product = { id: "11111111-1111-4111-8111-111111111111", restaurant_id: restaurant.id,
    name: "Plato de prueba", description: "", price: 2500, category: "Principales",
    image_data: null, model_url: null, featured: false, promo_price: null, available: true, created_at: "2026-01-01" };
  await page.route("**/api/dashboard", route => route.fulfill({ json: { restaurant, products: [product], metrics: { visits: 15, productViews: 30, orderClicks: 4, topProducts: [{ product_id: product.id, name: product.name, views: 12 }] } } }));
  await page.goto("/panel");
  await page.getByRole("button", { name: "Editar" }).click();
  await expect(page.getByText("PROMOCIÓN Y DESTACADOS")).toBeVisible();
  await page.getByLabel("Destacar al principio de la carta").check();
  await page.getByLabel("Precio promocional en ARS (opcional)").fill("2000");
  await page.getByRole("button", { name: "Cerrar", exact: true }).click();
  await page.getByRole("button", { name: "Resultados" }).click();
  await expect(page.getByText("CLICS PARA PEDIR")).toBeVisible();
  await expect(page.locator(".metrics-grid strong").last()).toHaveText("4");
  await expectNoPageOverflow(page);
});

test("new-account trial and updated prices are clear on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await expect(page.locator(".trial-badge")).toHaveCount(2);
  await expect(page.locator(".price-card").first()).toContainText("10.000");
  await expect(page.locator(".price-card").last()).toContainText("18.000");

  const trialRestaurant = { ...restaurant, is_trial: true };
  await page.route("**/api/admin/restaurants", route => route.fulfill({ json: { restaurants: [trialRestaurant] } }));
  await page.route("**/api/dashboard", route => route.fulfill({ json: { restaurant: trialRestaurant, products: [] } }));
  await page.goto("/admin");
  await expect(page.getByText("Prueba gratis")).toBeVisible();
  await page.getByRole("button", { name: "Agregar local" }).click();
  await expect(page.getByText("El primer mes es gratis", { exact: false })).toBeVisible();
  await expect(page.getByRole("option", { name: "Esencial · $10.000/mes" })).toHaveCount(1);
  await expect(page.getByRole("option", { name: "Premium · $18.000/mes" })).toHaveCount(1);
  await page.goto("/panel");
  await expect(page.getByText("Tu primer mes gratis está activo")).toBeVisible();
  await expect(page.getByText(/Después cuesta.*18.000/)).toBeVisible();
  await expectNoPageOverflow(page);
});
