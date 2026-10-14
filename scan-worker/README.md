# Procesador 3D propio de Polo

Este servicio recibe fotos tomadas en el panel Premium. Las procesa en la máquina que lo aloja: COLMAP reconstruye geometría y texturas, y el conversor local genera el GLB y lo ajusta al diámetro indicado. El resultado se revisa en el panel antes de publicarlo. No se envían fotos a proveedores de fotogrametría.

Requisitos: servidor Linux con GPU NVIDIA y drivers compatibles, NVIDIA Container Toolkit, Docker Compose, un dominio con DNS apuntando al servidor y puertos 80/443 abiertos. La imagen oficial de COLMAP documenta la necesidad de NVIDIA/CUDA para la reconstrucción densa: https://github.com/colmap/colmap/blob/main/docker/README.md. La compilación/descarga inicial de las imágenes puede ser grande.

1. Copiá `.env.example` a `.env` dentro de este directorio. Indicá el dominio público del procesador, la URL de producción de Polo y un secreto aleatorio de al menos 32 caracteres. El mismo secreto va en Vercel como `SCAN_WORKER_SECRET`; `SCAN_WORKER_URL` debe ser `https://` seguido por ese dominio.
2. Ejecutá `docker compose up -d --build`. Caddy obtiene el certificado TLS y publica el servicio en HTTPS. Verificá `https://tu-dominio/health`.
3. Desplegá Polo con las dos variables configuradas. Abrí un producto Premium guardado desde el celular, sacá 20–50 fotos alrededor del plato y esperá la reconstrucción. Revisá la escala y la textura antes de pulsar «Publicar 3D y AR».

El volumen `scan_data` guarda trabajos y GLB publicados. Hacé copias de seguridad de ese volumen. El trabajador procesa un trabajo a la vez y retoma los pendientes tras reiniciar. Una captura puede fallar si faltan ángulos, enfoque o textura visual; el panel mostrará el fallo para repetirla. Para producción conviene fijar una versión probada de la imagen de COLMAP, establecer límites de recursos y probar el flujo con varias fotos reales antes de ofrecerlo a locales.
