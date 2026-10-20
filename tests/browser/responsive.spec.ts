import { expect, test, type Page } from "@playwright/test";
import { SignJWT } from "jose";

const logo = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200"><rect width="1200" height="1200" fill="#246e3f"/><path d="M600 200v800M200 600h800M317 317l566 566M883 317 317 883" stroke="white" stroke-width="110"/></svg>')}`;
const restaurant = {
  id: "browser-fixture", name: "Cafetería del Parque y Cocina de Encuentros", slug: "cafe-del-parque",
  type: "Cafetería", plan: "premium", palette: "oliva", custom_primary: null, custom_accent: null, logo_data: logo,
  description: "Café y sabores para compartir.", address: "Buenos Aires", instagram: "", whatsapp: "5491112345678", orders_enabled: true,
  is_enabled: true, paid_until: "2099-01-01", created_at: "2026-01-01",
};

async function signInForBrowserTest(page: Page, role: "admin" | "restaurant") {
  const token = await new SignJWT({ role, email: "browser@example.test", ...(role === "restaurant" ? { restaurantId: restaurant.id } : {}) })
    .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("1h")
    .sign(new TextEncoder().encode(process.env.AUTH_SECRET));
  await page.context().addCookies([{ name: "mesa_session", value: token, url: "http://localhost:3001" }]);
}

test("private panels redirect before rendering without a session", async ({ page, request }) => {
  for (const path of ["/admin", "/panel"]) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(response.headers().location).toBe("/ingresar");
    await page.goto(path);
    await expect(page).toHaveURL(/\/ingresar$/);
    await expect(page.locator(".panel-layout")).toHaveCount(0);
  }
  await signInForBrowserTest(page, "restaurant");
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/ingresar$/);
  await signInForBrowserTest(page, "admin");
  await page.goto("/panel");
  await expect(page).toHaveURL(/\/ingresar$/);
});

test("logging out removes access to the admin panel", async ({ page }) => {
  await signInForBrowserTest(page, "admin");
  await page.route("**/api/admin/restaurants", route => route.fulfill({ json: { restaurants: [] } }));
  await page.goto("/admin");
  await expect(page.locator(".panel-layout")).toBeVisible();
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page).toHaveURL(/\/ingresar$/);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/ingresar$/);
  await expect(page.locator(".panel-layout")).toHaveCount(0);
});

test("admin sees the owner's signup phone", async ({ page }) => {
  await signInForBrowserTest(page, "admin");
  await page.route("**/api/admin/restaurants", route => route.fulfill({ json: {
    restaurants: [{ ...restaurant, owner_email: "nuevo@example.com", owner_phone: "+54 9 11 1234-5678", product_count: 0 }],
  } }));
  await page.goto("/admin");
  await expect(page.getByText("Tel.: +54 9 11 1234-5678")).toBeVisible();
});

test("admin saves payment links and sends a due notice once", async ({ page }) => {
  await signInForBrowserTest(page, "admin");
  const local = { ...restaurant, id: "11111111-1111-4111-8111-111111111111", name: "Café Central", plan: "basic", owner_email: "owner@example.test", signup_status: "active", paid_until: "2020-01-01T00:00:00Z", product_count: 0 };
  let sent = false;
  let links = { basic: "", premium: "" };
  await page.route("**/api/admin/restaurants", route => route.fulfill({ json: { restaurants: [{ ...local, billing_notice_sent_at: sent ? "2026-10-19T00:00:00Z" : null }] } }));
  await page.route("**/api/admin/billing", async route => {
    if (route.request().method() === "PATCH") {
      links = route.request().postDataJSON();
      await route.fulfill({ json: { ok: true } });
    } else await route.fulfill({ json: links });
  });
  await page.route(`**/api/admin/restaurants/${local.id}/billing-notice`, async route => {
    expect(route.request().method()).toBe("POST");
    sent = true;
    await route.fulfill({ json: { ok: true } });
  });
  await page.goto("/admin");
  await page.getByRole("textbox", { name: /Esencial/ }).fill("https://mpago.la/basic-test");
  await page.getByRole("textbox", { name: /Premium/ }).fill("https://mpago.la/premium-test");
  await page.getByRole("button", { name: "Guardar enlaces" }).click();
  await expect(page.getByText("Enlaces de Mercado Pago guardados.")).toBeVisible();
  expect(links).toEqual({ basic: "https://mpago.la/basic-test", premium: "https://mpago.la/premium-test" });
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "Enviar aviso", exact: true }).click();
  await expect(page.getByText("Aviso de pago enviado a owner@example.test.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Aviso enviado" })).toBeDisabled();
});

test("admin reviews a local's proof before crediting its period", async ({ page }) => {
  await signInForBrowserTest(page, "admin");
  const local = { ...restaurant, id: "11111111-1111-4111-8111-111111111111", name: "Café Central", plan: "basic", owner_email: "owner@example.test", signup_status: "active", paid_until: "2020-01-01T00:00:00Z", product_count: 0 };
  const proofId = "22222222-2222-4222-8222-222222222222";
  let approved = false;
  await page.route("**/api/admin/restaurants", route => route.fulfill({ json: { restaurants: [local] } }));
  await page.route("**/api/admin/billing", route => route.fulfill({ json: { basic: "", premium: "" } }));
  await page.route("**/api/admin/payment-proofs", route => route.fulfill({ json: { proofs: approved ? [] : [{
    id: proofId, restaurant_name: local.name, owner_email: local.owner_email,
    period_due_at: local.paid_until, plan: "basic", filename: "pago.pdf", mime_type: "application/pdf",
    status: "pending", submitted_at: "2026-10-19T12:00:00Z", current_period: true,
  }] } }));
  await page.route(`**/api/admin/payment-proofs/${proofId}`, async route => {
    expect(route.request().postDataJSON()).toEqual({ action: "approve" });
    approved = true;
    await route.fulfill({ json: { ok: true } });
  });
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Comprobantes pendientes" })).toBeVisible();
  await expect(page.getByText("owner@example.test · Plan Esencial", { exact: false })).toBeVisible();
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "Aprobar y acreditar" }).click();
  await expect(page.getByText("No hay comprobantes pendientes.")).toBeVisible();
  expect(approved).toBe(true);
});

test("admin resets the selected local password and can retry errors on mobile", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await signInForBrowserTest(page, "admin");
  const id = "11111111-1111-4111-8111-111111111111";
  const local = { ...restaurant, id, name: "Jagger", owner_email: "owner@example.test", product_count: 0 };
  await page.route("**/api/admin/restaurants", route => route.fulfill({ json: { restaurants: [local] } }));
  let submissions = 0;
  await page.route(`**/api/admin/restaurants/${id}/password`, async route => {
    expect(route.request().method()).toBe("POST");
    expect(route.request().postDataJSON()).toEqual({ password: "Fixture password 123" });
    submissions++;
    if (submissions === 1) await route.fulfill({ status: 500, json: { error: "No se pudo guardar. Probá otra vez." } });
    else await route.fulfill({ json: { ok: true } });
  });
  await page.goto("/admin");
  await page.getByRole("button", { name: "Restablecer contraseña de Jagger" }).click();
  const dialog = page.getByRole("dialog", { name: "Restablecer contraseña" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("owner@example.test");
  const password = dialog.getByLabel("Nueva contraseña", { exact: true });
  const confirmation = dialog.getByLabel("Repetir nueva contraseña");
  await expect(password).toBeFocused();
  await expectNoPageOverflow(page);
  await page.screenshot({ path: testInfo.outputPath("password-reset.png") });
  await password.fill("Fixture password 123");
  await confirmation.fill("Different password 456");
  await dialog.getByRole("button", { name: "Guardar contraseña" }).click();
  await expect(dialog.getByRole("alert")).toHaveText("Las contraseñas no coinciden");
  expect(submissions).toBe(0);
  await dialog.getByLabel("Mostrar contraseña").check();
  await expect(password).toHaveAttribute("type", "text");
  await confirmation.fill("Fixture password 123");
  await dialog.getByRole("button", { name: "Guardar contraseña" }).click();
  await expect(dialog.getByRole("alert")).toHaveText("No se pudo guardar. Probá otra vez.");
  await expect(dialog.getByRole("button", { name: "Guardar contraseña" })).toBeEnabled();
  await dialog.getByRole("button", { name: "Guardar contraseña" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("status")).toContainText("Contraseña de Jagger actualizada");
  await expect(page.getByRole("status")).not.toContainText("Fixture password");
  expect(submissions).toBe(2);
  await page.getByRole("button", { name: "Restablecer contraseña de Jagger" }).click();
  await expect(password).toHaveValue("");
  await expect(confirmation).toHaveValue("");
  await expect(password).toHaveAttribute("type", "password");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});

test("password reset endpoint rejects unauthenticated, non-admin and invalid requests", async ({ page, request }) => {
  const id = "11111111-1111-4111-8111-111111111111";
  const path = `/api/admin/restaurants/${id}/password`;
  const headers = { Origin: "http://localhost:3001" };
  const data = { password: "Fixture password 123" };
  expect((await request.post(path, { headers, data })).status()).toBe(401);
  await signInForBrowserTest(page, "restaurant");
  expect((await page.request.post(path, { headers, data })).status()).toBe(401);
  await signInForBrowserTest(page, "admin");
  expect((await page.request.post(path, { headers: { Origin: "https://other.example.test" }, data })).status()).toBe(403);
  expect((await page.request.post(path, { headers, data: { password: "short" } })).status()).toBe(400);
  expect((await page.request.post(path, { headers, data: { password: "🔒".repeat(20) } })).status()).toBe(400);
});

test("forgot password is reachable from login and requests a recovery email", async ({ page }, testInfo) => {
  let attempts = 0;
  await page.route("**/api/auth/password/forgot", async route => {
    expect(route.request().postDataJSON()).toEqual({ email: "owner@example.test" });
    attempts++;
    if (attempts === 1) await route.fulfill({ status: 500, json: { error: "No se pudo completar la solicitud. Probá otra vez." } });
    else await route.fulfill({ status: 202, json: { message: "Si el correo pertenece a una cuenta de local, recibirás un enlace. Revisá también spam." } });
  });
  await page.goto("/ingresar");
  await page.getByRole("link", { name: "Olvidé mi contraseña" }).click();
  await expect(page).toHaveURL(/\/recuperar$/);
  for (const width of [320, 375, 1440]) {
    await page.setViewportSize({ width, height: 812 });
    await expectNoPageOverflow(page);
  }
  await page.setViewportSize({ width: 375, height: 812 });
  await page.screenshot({ path: testInfo.outputPath("forgot-password.png") });
  await page.getByLabel("Correo electrónico").fill("owner@example.test");
  await page.getByRole("button", { name: "Enviar enlace de recuperación" }).click();
  await expect(page.locator("form").getByRole("alert")).toContainText("Probá otra vez");
  await page.getByRole("button", { name: "Enviar enlace de recuperación" }).click();
  await expect(page.getByRole("heading", { name: "Revisá tu correo." })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("30 minutos");
  await expect(page.getByRole("link", { name: "Ir a ingresar" })).toHaveAttribute("href", "/ingresar");
  expect(attempts).toBe(2);
});

test("recovery link handles expired links and saves a matching new password", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 375, height: 812 });
  let submissions = 0;
  await page.route("**/api/auth/password/reset", async route => {
    submissions++;
    const data = route.request().postDataJSON();
    expect(data.password).toBe("Fixture password 123");
    if (data.token === "expired-fixture") await route.fulfill({ status: 400, json: { error: "El enlace venció, ya se usó o no es válido. Solicitá uno nuevo." } });
    else {
      expect(data.token).toBe("valid-fixture");
      await route.fulfill({ json: { ok: true } });
    }
  });
  await page.goto("/recuperar?token=expired-fixture");
  const password = page.getByLabel("Nueva contraseña", { exact: true });
  const confirmation = page.getByLabel("Repetir nueva contraseña");
  await password.fill("Fixture password 123");
  await confirmation.fill("Wrong fixture password");
  await page.getByRole("button", { name: "Guardar nueva contraseña" }).click();
  await expect(page.locator("form").getByRole("alert")).toHaveText("Las contraseñas no coinciden");
  expect(submissions).toBe(0);
  await confirmation.fill("Fixture password 123");
  await page.getByRole("button", { name: "Guardar nueva contraseña" }).click();
  await expect(page.locator("form").getByRole("alert")).toContainText("El enlace venció");
  await page.getByRole("link", { name: "Solicitar otro enlace" }).click();
  await expect(page.getByLabel("Correo electrónico")).toBeVisible();
  await expect(page.locator("form").getByRole("alert")).toHaveCount(0);
  await page.goto("/recuperar?token=valid-fixture");
  await expectNoPageOverflow(page);
  await page.screenshot({ path: testInfo.outputPath("new-password.png") });
  await password.fill("Fixture password 123");
  await confirmation.fill("Fixture password 123");
  await page.getByLabel("Mostrar contraseña").check();
  await expect(password).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "Guardar nueva contraseña" }).click();
  await expect(page.getByRole("heading", { name: "Contraseña actualizada." })).toBeVisible();
  await expect(page.getByRole("status")).not.toContainText("Fixture password");
  await page.getByRole("link", { name: "Ir a ingresar" }).click();
  await expect(page).toHaveURL(/\/ingresar$/);
});

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
  for (const dish of ["Ensalada de estación", "Burrata de estación", "Croquetas de hongos", "Hamburguesa de la casa", "Pasta al pesto", "Brochetas de la casa", "Risotto de hongos", "Limonada de menta", "Torta de chocolate y frutillas"]) {
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
  await dialog.getByLabel("Tu nombre").fill("Ana Pérez");
  await dialog.getByLabel("Tu teléfono").fill("+54 9 261 123-4567");
  await dialog.getByRole("button", { name: "Simular pedido" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("status")).toContainText("Pedido de ejemplo simulado.");
  await expect(page.getByRole("status")).not.toContainText("19.800");
});

test("plan examples show ordering only in Premium", async ({ page }) => {
  await page.goto("/");
  await page.locator(".price-card").first().getByRole("link", { name: "Ver carta Esencial" }).click();
  await expect(page).toHaveURL(/\/demo\/esencial$/);
  await expect(page.locator(".demo-ribbon")).toContainText("PLAN ESENCIAL");
  await expect(page.getByRole("heading", { name: "Mesa Luma" })).toBeVisible();
  await expect(page.locator(".menu-footer-links")).toContainText("@mesaluma_ejemplo · ejemplo");
  await expect(page.locator('.menu-footer-links a[href*="instagram.com"]')).toHaveCount(0);
  await expect(page.locator(".menu-page")).not.toHaveClass(/menu-premium/);
  await expect(page.locator(".menu-product")).toHaveCount(9);
  await expect(page.getByRole("button", { name: "Agregar", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Ver pedido/ })).toHaveCount(0);
  await expect(page.locator(".product-badge")).toHaveCount(0);
  const essentialSalad = page.locator(".menu-product").filter({ has: page.getByRole("heading", { name: "Ensalada de estación" }) });
  await expect(essentialSalad.locator(".menu-price strong")).toHaveText(/12.000/);

  await page.goto("/");
  await page.locator(".price-card").filter({ has: page.getByRole("heading", { name: "Premium", exact: true }) }).getByRole("link", { name: "Probar carta Premium" }).click();
  await expect(page).toHaveURL(/\/demo$/);
  await expect(page.locator(".demo-ribbon")).toContainText("PLAN PREMIUM");
  await expect(page.getByRole("heading", { name: "Mesa Luma" })).toBeVisible();
  await expect(page.locator('.menu-footer-links a[href*="instagram.com"]')).toHaveCount(0);
  await expect(page.locator(".menu-page")).toHaveClass(/menu-premium/);
  await expect(page.locator(".menu-cover-photo img")).toBeVisible();
  await expect(page.getByRole("button", { name: "Agregar", exact: true })).toHaveCount(9);
  await expect(page.getByRole("button", { name: /Ver pedido/ })).toBeVisible();
  const premiumSalad = page.locator(".menu-product").filter({ has: page.getByRole("heading", { name: "Ensalada de estación" }) });
  await expect(premiumSalad.getByText("Oferta")).toBeVisible();
  await expect(premiumSalad.locator(".menu-price strong")).toHaveText(/9.900/);
});

test("mobile pages and restaurant forms fit the viewport", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.route("**/api/dashboard", route => route.fulfill({ json: { restaurant, products: [] } }));
  await page.route("**/api/admin/restaurants", route => route.fulfill({ json: { restaurants: [] } }));
  await page.goto("/ingresar");
  await expect(page.getByText("¿Todavía no tenés cuenta?")).toBeVisible();
  await expect(page.getByRole("link", { name: "Registrate" })).toHaveAttribute("href", "/registrarse");
  for (const path of ["/", "/ingresar", "/registrarse"]) {
    await page.goto(path);
    await expect(page.getByRole("heading").first()).toBeVisible();
    if (path === "/") {
      await expect(page.locator(".footer-support").getByRole("link", { name: "+54 9 2617 58-6685" })).toHaveAttribute("href", "tel:+5492617586685");
    } else {
      await expect(page.locator(".auth-support").getByRole("link", { name: "contacto@polopositivoar.com" })).toHaveAttribute("href", "mailto:contacto@polopositivoar.com");
    }
    await expectNoPageOverflow(page);
  }
  await signInForBrowserTest(page, "admin");
  await page.goto("/admin");
  await expect(page.getByRole("heading").first()).toBeVisible();
  await expect(page.locator(".panel-mobile-support").getByRole("link", { name: "+54 9 2617 58-6685" })).toBeVisible();
  await expectNoPageOverflow(page);
  await signInForBrowserTest(page, "restaurant");
  await page.goto("/panel");
  await expect(page.getByRole("heading").first()).toBeVisible();
  await expectNoPageOverflow(page);
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
  await page.route("**/api/dashboard", route => route.fulfill({ json: { restaurant, products: [product], metrics: { visits: 15, productViews: 30, ordersReceived: 4, topProducts: [{ product_id: product.id, name: product.name, views: 12 }] } } }));
  await signInForBrowserTest(page, "restaurant");
  await page.goto("/panel");
  await page.getByRole("button", { name: "Editar" }).click();
  await expect(page.getByText("PROMOCIÓN Y DESTACADOS")).toBeVisible();
  await page.getByLabel("Destacar al principio de la carta").check();
  await page.getByLabel("Precio promocional en ARS (opcional)").fill("2000");
  await page.getByRole("button", { name: "Cerrar", exact: true }).click();
  await page.getByRole("button", { name: "Resultados" }).click();
  await expect(page.getByText("PEDIDOS RECIBIDOS", { exact: true })).toBeVisible();
  await expect(page.locator(".metrics-grid strong").last()).toHaveText("4");
  await expectNoPageOverflow(page);
});

test("owner can save a custom two-color palette", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  let saved = { ...restaurant };
  await page.route("**/api/dashboard", async (route) => {
    if (route.request().method() === "PATCH") {
      const data = route.request().postDataJSON();
      expect(data).toMatchObject({ palette: "personalizado", custom_primary: "#195273", custom_accent: "#E6A83B" });
      saved = { ...saved, ...data };
      await route.fulfill({ json: { ok: true } });
      return;
    }
    await route.fulfill({ json: { restaurant: saved, products: [] } });
  });
  await signInForBrowserTest(page, "restaurant");
  await page.goto("/panel");
  await page.getByRole("button", { name: "Identidad del local" }).click();
  await page.getByRole("button", { name: "Paleta personalizada" }).click();
  await page.getByRole("textbox", { name: "Hexadecimal principal" }).fill("#195273");
  await page.getByRole("textbox", { name: "Hexadecimal de acento" }).fill("#E6A83B");
  await expect(page.locator(".palette-preview")).toHaveCSS("color", "rgb(255, 255, 255)");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByRole("button", { name: "Paleta personalizada" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("textbox", { name: "Hexadecimal principal" })).toHaveValue("#195273");
  await expectNoPageOverflow(page);
});

test("Premium owner keeps older orders until marking them delivered", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const orderId = "22222222-2222-4222-8222-222222222222";
  await page.route("**/api/dashboard", route => route.fulfill({ json: { restaurant, products: [] } }));
  await page.route("**/api/orders", route => route.fulfill({ json: { orders: [{
    id: orderId, restaurant_id: restaurant.id, customer_name: "Ana Pérez", customer_phone: "+54 9 261 123-4567",
    notes: "Sin cebolla", total: 22800, status: "new", created_at: "2026-10-14T18:30:00Z",
    items: [{ product_id: null, product_name: "Ensalada", unit_price: 9900, quantity: 2, line_total: 19800 }, { product_id: null, product_name: "Limonada", unit_price: 3000, quantity: 1, line_total: 3000 }],
  }] } }));
  await page.route("**/api/orders/*", async (route) => {
    expect(["preparing", "completed"]).toContain(route.request().postDataJSON().status);
    await route.fulfill({ json: { ok: true } });
  });
  await signInForBrowserTest(page, "restaurant");
  await page.goto("/panel");
  await page.getByRole("button", { name: "Pedidos" }).click();
  await expect(page.getByRole("heading", { name: "Pedidos sin entregar" })).toBeVisible();
  await expect(page.locator(".order-card")).toContainText("Ana Pérez");
  await expect(page.locator(".order-card")).toContainText("14/10/2026");
  await expect(page.locator(".order-card")).toContainText("22.800");
  await expect(page.locator(".order-card")).toContainText("Sin cebolla");
  await page.getByLabel(`Estado del pedido ${orderId.slice(0, 8)}`).selectOption("preparing");
  await expect(page.getByLabel(`Estado del pedido ${orderId.slice(0, 8)}`)).toHaveValue("preparing");
  await page.getByLabel(`Estado del pedido ${orderId.slice(0, 8)}`).selectOption("completed");
  await expect(page.locator(".order-card")).toHaveCount(0);
  await page.getByRole("button", { name: "Actualizar" }).click();
  await expect(page.locator(".order-card")).toHaveCount(0);
  await expectNoPageOverflow(page);
});

test("public order endpoint rejects invalid and cross-site submissions", async ({ request }) => {
  const data = { restaurantId: "11111111-1111-4111-8111-111111111111", customerName: "Ana Pérez", customerPhone: "+54 9 261 123-4567", notes: "", items: [] };
  const invalid = await request.post("/api/orders", { headers: { Origin: "http://localhost:3001" }, data });
  expect(invalid.status()).toBe(400);
  const crossSite = await request.post("/api/orders", { headers: { Origin: "https://otro-sitio.example" }, data });
  expect(crossSite.status()).toBe(403);
});

test("new-account trial and updated prices are clear on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await expect(page.locator(".trial-badge")).toHaveCount(2);
  await expect(page.locator(".price-card").first()).toContainText("10.000");
  await expect(page.locator(".price-card").filter({ has: page.getByRole("heading", { name: "Premium", exact: true }) })).toContainText("18.000");
  await expect(page.locator(".price-card")).toHaveCount(3);
  const gold = page.locator(".price-card").filter({ has: page.getByRole("heading", { name: "Gold", exact: true }) });
  await expect(gold).toContainText("A medida");
  await expect(gold.locator(".trial-badge")).toHaveCount(0);
  const contactUrl = new URL((await gold.getByRole("link", { name: "Solicitar presupuesto" }).getAttribute("href"))!);
  expect(contactUrl.origin + contactUrl.pathname).toBe("https://wa.me/5492617586685");
  expect(contactUrl.searchParams.get("text")).toContain("plan Gold");
  await expectNoPageOverflow(page);

  const trialRestaurant = { ...restaurant, is_trial: true };
  await page.route("**/api/admin/restaurants", route => route.fulfill({ json: { restaurants: [trialRestaurant] } }));
  await page.route("**/api/dashboard", route => route.fulfill({ json: { restaurant: trialRestaurant, products: [] } }));
  await signInForBrowserTest(page, "admin");
  await page.goto("/admin");
  await expect(page.getByText("Prueba gratis")).toBeVisible();
  await page.getByRole("button", { name: "Agregar local" }).click();
  await expect(page.getByText("El primer mes es gratis", { exact: false })).toBeVisible();
  await expect(page.getByRole("option", { name: "Esencial · $10.000/mes" })).toHaveCount(1);
  await expect(page.getByRole("option", { name: "Premium · $18.000/mes" })).toHaveCount(1);
  await signInForBrowserTest(page, "restaurant");
  await page.goto("/panel");
  await expect(page.getByText("Tu primer mes gratis está activo")).toBeVisible();
  await expect(page.getByText(/Después cuesta.*18.000/)).toBeVisible();
  await expectNoPageOverflow(page);
});

test("signup from login lets a local choose its plan and contact phone", async ({ page, request }) => {
  const invalidPhone = await request.post("/api/auth/register", {
    headers: { Origin: "http://localhost:3001" },
    data: { name: "Café Nuevo", type: "Cafetería", plan: "premium", email: "nuevo@example.com", phone: "123", password: "claveSegura123" },
  });
  expect(invalidPhone.status()).toBe(400);
  await page.route("**/api/auth/register", async (route) => {
    expect(route.request().postDataJSON()).toMatchObject({ plan: "premium", email: "nuevo@example.com", phone: "+54 9 11 1234-5678" });
    await route.fulfill({ status: 202, json: { message: "Solicitud recibida" } });
  });
  await page.goto("/ingresar");
  await page.getByRole("link", { name: "Registrate" }).click();
  await expect(page).toHaveURL(/\/registrarse$/);
  await expect(page.getByLabel("Plan", { exact: true })).toHaveValue("");
  await page.getByLabel("Plan", { exact: true }).selectOption("premium");
  await expect(page.getByText(/18\.000 por mes/)).toBeVisible();
  await page.getByLabel("Nombre del local").fill("Café Nuevo");
  await page.getByLabel("Correo electrónico").fill("nuevo@example.com");
  await page.getByLabel("Número de teléfono").fill("+54 9 11 1234-5678");
  await page.getByLabel("Contraseña", { exact: true }).fill("claveSegura123");
  await page.getByLabel("Repetir contraseña").fill("claveSegura123");
  await page.getByRole("button", { name: "Empezar gratis" }).click();
  await expect(page.getByRole("heading", { name: "Ya casi está." })).toBeVisible();
});

test("each plan opens signup and a new request stays pending", async ({ page, request }) => {
  const crossSite = await request.post("/api/auth/register", {
    headers: { Origin: "https://otro-sitio.example", "Content-Type": "application/json" },
    data: { name: "Prueba", type: "Bar", plan: "premium", email: "test@example.com", password: "1234567890" },
  });
  expect(crossSite.status()).toBe(403);

  await page.route("**/api/auth/register", async (route) => {
    expect(route.request().postDataJSON()).toMatchObject({ name: "Café Nuevo", type: "Cafetería", plan: "premium", email: "nuevo@example.com" });
    await route.fulfill({ status: 202, json: { message: "Solicitud recibida" } });
  });
  await page.goto("/");
  await expect(page.locator('.price-card').first().getByRole("link", { name: "Empezar gratis" })).toHaveAttribute("href", "/registrarse/esencial");
  await page.locator('.price-card').filter({ has: page.getByRole("heading", { name: "Premium", exact: true }) }).getByRole("link", { name: "Empezar gratis" }).click();
  await expect(page).toHaveURL(/\/registrarse\/premium$/);
  await expect(page.getByLabel("Plan", { exact: true })).toHaveValue("premium");
  await expectNoPageOverflow(page);
  await page.getByLabel("Nombre del local").fill("Café Nuevo");
  await page.getByLabel("Tipo de local").selectOption("Cafetería");
  await page.getByLabel("Correo electrónico").fill("nuevo@example.com");
  await page.getByLabel("Número de teléfono").fill("+54 9 11 1234-5678");
  await page.getByLabel("Contraseña", { exact: true }).fill("claveSegura123");
  await page.getByLabel("Repetir contraseña").fill("claveSegura123");
  await page.getByRole("button", { name: "Empezar gratis" }).click();
  await expect(page.getByRole("heading", { name: "Ya casi está." })).toBeVisible();

  await page.route("**/api/auth/verify", route => {
    expect(route.request().postDataJSON()).toMatchObject({ token: "a".repeat(64), password: "claveSegura123" });
    return route.fulfill({ json: { ok: true } });
  });
  await page.goto(`/verificar?token=${"a".repeat(64)}`);
  await page.getByLabel("Contraseña").fill("claveSegura123");
  await page.getByRole("button", { name: "Confirmar y activar" }).click();
  await expect(page.getByRole("heading", { name: "¡Tu cuenta está lista!" })).toBeVisible();

  const pending = { ...restaurant, signup_status: "pending", is_enabled: false, paid_until: null, owner_email: "nuevo@example.com" };
  await page.route("**/api/admin/restaurants", route => route.fulfill({ json: { restaurants: [pending] } }));
  await page.route("**/api/admin/restaurants/*", route => route.fulfill({ json: { ok: true } }));
  await signInForBrowserTest(page, "admin");
  await page.goto("/admin");
  await expect(page.getByText("Pendiente", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Activar prueba" })).toBeVisible();
  page.once("dialog", dialog => dialog.dismiss());
  await page.getByRole("button", { name: "Activar prueba" }).click();
  await expect(page.getByText("Pendiente", { exact: true })).toBeVisible();
});
