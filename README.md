# Polo

Plataforma de cartas digitales para restaurantes, cafeterías y bares. Lista para desplegar en Vercel con Next.js y PostgreSQL.

## Funciones

- **Administrador:** crea locales y accesos, cambia planes, pausa cuentas y registra cuotas mensuales manualmente.
- **Cada local:** edita nombre, descripción, logo, contacto y una de cinco paletas; carga productos con foto, precio, categoría y disponibilidad.
- **Esencial:** $15.000 ARS al mes, hasta 100 productos.
- **Premium:** $25.000 ARS al mes, hasta 200 productos, destacados, precios promocionales, carrito con pedido por WhatsApp y métricas de la carta.
- **Carta pública:** `/menu/slug-del-local`. Si la cuota venció o el administrador pausó la cuenta, la carta deja de mostrar los productos.
- **QR en ambos planes:** cada local puede descargar el código de su carta en PNG o SVG y copiar su enlace desde la pestaña «QR y enlace». El QR conserva su dirección cuando se editan los productos.

## Preparación

1. Creá una base PostgreSQL. Puede ser cualquier proveedor accesible desde Vercel.
2. Copiá `.env.example` a `.env.local` y completá las variables. Generá `AUTH_SECRET` con al menos 32 caracteres aleatorios. El correo y la contraseña `ADMIN_*` son el acceso del administrador principal. Para desarrollo local, dejá `NEXT_PUBLIC_SITE_URL` vacío; los QR usarán el origen local.
3. Ejecutá `npm install` y `npm run dev`. Abrí `http://localhost:3000`.
4. Ingresá en `/ingresar` con la cuenta administradora. Creá un local y registrá su primera cuota para publicar la carta.

Las tablas se crean automáticamente cuando se hace la primera consulta a la base. Las contraseñas de los locales se guardan con bcrypt y el acceso se mantiene mediante una cookie firmada, HTTP only.

## Vercel

Importá este directorio como proyecto Next.js. Configurá `DATABASE_URL`, `AUTH_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` y `NEXT_PUBLIC_SITE_URL` como variables de entorno en Vercel. `NEXT_PUBLIC_SITE_URL` debe ser la dirección estable de producción (por ejemplo, `https://tu-sitio.vercel.app`); así los QR generados incluso desde una vista previa apuntan a la carta publicada. Desplegá con la configuración predeterminada de Next.js. La base PostgreSQL debe permitir conexiones desde Vercel; los archivos que se suben como logo o fotos se optimizan en el navegador y se guardan en la base de datos. No se usa el disco temporal de Vercel para datos persistentes.

Para recibir pedidos, el local Premium debe cargar su número con código de país en «Identidad del local» y activar «Habilitar pedidos por WhatsApp». Los clientes eligen cantidades en la carta y abren WhatsApp con el pedido y total estimado. El local confirma disponibilidad, importe final y entrega por ese canal. Polo no procesa pagos ni conoce si el mensaje finalmente se envió.

## Notas operativas

- El registro de cuota suma un mes calendario al vencimiento vigente, o desde el momento del pago si ya venció. Se guarda un asiento en `payments` con el importe del plan en ese momento.
- El plan Esencial no admite más de 100 productos. Al bajar de Premium se desactivan los pedidos, destacados y precios promocionales.
- El panel Premium muestra visitas a la carta, vistas de productos y clics para abrir el pedido durante los últimos 30 días. Son señales de interés, no ventas confirmadas; `/demo` no genera eventos.
- Esta versión no cobra automáticamente ni envía correos. El administrador acredita pagos manualmente y entrega las credenciales al local por su propio canal.
- `/demo` contiene una carta ilustrativa sin datos reales, con fotos, destacados, una promoción y un carrito de ejemplo. En la demo el pedido se copia al portapapeles, sin enviarse a ningún local. La foto de la torta es [Strawberry Chocolate Cake de Poly Haven](https://polyhaven.com/a/strawberry_chocolate_cake), bajo licencia CC0.

## Comandos

```bash
npm run dev
npm run typecheck
npm run test:qr
npm run test:browsers
npm run build
npm start
```

Las pruebas de navegadores verifican el menú y los formularios en Chromium, Firefox y WebKit, incluyendo vistas móviles de iPhone y Android. Antes de ejecutarlas por primera vez, instalá los motores con `npx playwright install chromium firefox webkit`. El flujo de GitHub Actions ejecuta estas verificaciones en Linux en cada actualización de `main` y cada pull request.
