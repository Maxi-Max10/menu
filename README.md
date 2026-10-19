# Polo

Plataforma de cartas digitales para restaurantes, cafeterías y bares. Lista para desplegar en Vercel con Next.js y PostgreSQL.

## Funciones

- **Registro desde la landing:** cada local elige Esencial o Premium, crea su cuenta y aparece como pendiente en el panel administrador. El primer mes gratis empieza al verificar su correo o al ser activado por el administrador.
- **Administrador:** ve las solicitudes, puede activar pruebas, crear locales, cambiar planes, pausar cuentas, registrar cuotas mensuales manualmente y restablecer contraseñas desde el botón con la llave junto a cada local. La contraseña nueva debe tener al menos 10 caracteres y se confirma antes de guardarla; las sesiones anteriores de esa cuenta quedan invalidadas.
- **Cada local:** edita nombre, descripción, logo, contacto y una de cinco paletas; carga productos con foto, precio, categoría y disponibilidad.
- **Esencial:** primer mes gratis para locales nuevos; después $10.000 ARS al mes, hasta 100 productos.
- **Premium:** primer mes gratis para locales nuevos; después $18.000 ARS al mes, hasta 200 productos, destacados, precios promocionales, carrito con pedido por WhatsApp y métricas de la carta.
- **Gold a medida:** tercera propuesta comercial en la landing, con todo Premium más una página personalizada del local con dominio propio, enlaces a redes, galería, horarios, mapa y consultas o reservas por WhatsApp. Se solicita presupuesto al contacto de Polo; precio, condiciones y desarrollo de la página se acuerdan por proyecto. No tiene alta automática ni una cuota predefinida en el panel.
- **Carta pública:** `/menu/slug-del-local`. Si venció la prueba o la cuota, o el administrador pausó la cuenta, la carta deja de mostrar los productos.
- **QR en ambos planes:** cada local puede descargar el código de su carta en PNG o SVG y copiar su enlace desde la pestaña «QR y enlace». El QR conserva su dirección cuando se editan los productos.

## Preparación

1. Creá una base PostgreSQL. Puede ser cualquier proveedor accesible desde Vercel.
2. Copiá `.env.example` a `.env.local` y completá las variables. Generá `AUTH_SECRET` con al menos 32 caracteres aleatorios. El correo y la contraseña `ADMIN_*` son el acceso del administrador principal. Para desarrollo local, dejá `NEXT_PUBLIC_SITE_URL` vacío; los QR usarán el origen local.
3. Ejecutá `npm install` y `npm run dev`. Abrí `http://localhost:3000`.
4. Ingresá en `/ingresar` con la cuenta administradora. También podés elegir un plan desde la landing y crear una cuenta nueva. Cuando el correo se confirma, la carta se publica durante un mes calendario sin registrar pago. Al terminar la prueba, registrá la primera cuota para mantenerla publicada.

Las tablas se crean automáticamente cuando se hace la primera consulta a la base. Las contraseñas de los locales se guardan con bcrypt y el acceso se mantiene mediante una cookie firmada, HTTP only. Los intentos de ingreso y registro tienen límites guardados en PostgreSQL.

Para recuperar una cuenta de local, elegí «Olvidé mi contraseña» en `/ingresar` o abrí `/recuperar`. Ingresá el correo del local para recibir un enlace firmado, válido por 30 minutos. El enlace está vinculado a la contraseña vigente y deja de servir al usarlo o cuando el administrador cambia la contraseña; dos intentos simultáneos no pueden reutilizarlo. Se usa el mismo correo SMTP que para la activación. Si el envío no está disponible, la pantalla indica cómo contactar a Polo y la respuesta no revela si el correo está registrado.

También podés ingresar como administrador en `/admin`, buscar el local y elegir «Restablecer contraseña». Definí una contraseña nueva y repetila para guardarla. El local podrá ingresar con su correo habitual y esa contraseña. En ambos métodos se invalidan las sesiones anteriores de esa cuenta. Las credenciales del administrador principal siguen gestionándose mediante `ADMIN_EMAIL` y `ADMIN_PASSWORD` en Vercel; la recuperación por correo es para cuentas de locales.

## Vercel

Importá este directorio como proyecto Next.js. Configurá `DATABASE_URL`, `AUTH_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` y `NEXT_PUBLIC_SITE_URL` como variables de entorno en Vercel. `NEXT_PUBLIC_SITE_URL` debe ser la dirección estable de producción (por ejemplo, `https://tu-sitio.vercel.app`); así los QR generados incluso desde una vista previa apuntan a la carta publicada. Desplegá con la configuración predeterminada de Next.js. La base PostgreSQL debe permitir conexiones desde Vercel; los archivos que se suben como logo o fotos se optimizan en el navegador y se guardan en la base de datos. No se usa el disco temporal de Vercel para datos persistentes.

Para que el registro se active sin intervención, configurá además `SMTP_USER=contacto@polopositivoar.com` y `SMTP_PASSWORD` con la contraseña de **esa casilla** de Hostinger en las variables privadas de Vercel. Polo usa `smtp.hostinger.com` con TLS en el puerto 465. La contraseña no debe ir en el repositorio ni en el chat. Si faltan estas variables o falla el envío, la solicitud queda pendiente y podés usar «Activar prueba» en el panel tras comprobar por tu cuenta quién pidió el acceso. El enlace de verificación vence en 24 horas, se usa una sola vez y exige la contraseña creada al registrarse; el mes gratis comienza al confirmarlo.

Para recibir pedidos, el local Premium debe cargar su número con código de país en «Identidad del local» y activar «Habilitar pedidos por WhatsApp». Los clientes eligen cantidades en la carta y abren WhatsApp con el pedido y total estimado. El local confirma disponibilidad, importe final y entrega por ese canal. Polo no procesa pagos ni conoce si el mensaje finalmente se envió.

## Notas operativas

- El registro de cuota suma un mes calendario al vencimiento vigente, o desde el momento del pago si ya venció. Se guarda un asiento en `payments` con el importe del plan en ese momento.
- El mes gratis empieza cuando se verifica el correo del dueño o el administrador activa un local nuevo, y se aplica una sola vez en ambos planes. No modifica vencimientos de locales existentes ni genera un asiento en `payments`. Si se registra un pago durante la prueba, el mes pagado empieza al terminarla.
- El plan Esencial no admite más de 100 productos. Al bajar de Premium se desactivan los pedidos, destacados y precios promocionales.
- El panel Premium muestra visitas a la carta, vistas de productos y clics para abrir el pedido durante los últimos 30 días. Son señales de interés, no ventas confirmadas; `/demo` no genera eventos.
- Esta versión todavía no cobra automáticamente. El administrador acredita pagos manualmente. Con SMTP configurado, la app envía el enlace de verificación; sin SMTP, el administrador debe aprobar la solicitud.
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
