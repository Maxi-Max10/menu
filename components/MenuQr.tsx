"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Download, ExternalLink, QrCode } from "lucide-react";
import { generateMenuQr, publicMenuUrl } from "@/lib/menu-qr";
import styles from "./MenuQr.module.css";

type QrFiles = { png: string; svg: string; url: string };

export function MenuQr({ restaurantName, slug }: { restaurantName: string; slug: string }) {
  const [files, setFiles] = useState<QrFiles | null>(null);
  const [error, setError] = useState("");
  const [copyNotice, setCopyNotice] = useState("");
  const [copied, setCopied] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setFiles(null);
    setError("");
    setCopied(false);
    setCopyNotice("");
    async function generate() {
      try {
        const url = publicMenuUrl(slug, window.location.origin);
        const qr = await generateMenuQr(url);
        if (!cancelled) setFiles({ ...qr, url });
      } catch {
        if (!cancelled) setError("No pudimos generar el QR. Intentá de nuevo.");
      }
    }
    void generate();
    return () => { cancelled = true; };
  }, [slug, retry]);

  async function copyLink() {
    if (!files) return;
    try {
      await navigator.clipboard.writeText(files.url);
      setCopied(true);
      setCopyNotice("Enlace copiado.");
    } catch {
      setCopied(false);
      setCopyNotice("Seleccioná el enlace de abajo y copialo manualmente.");
    }
  }

  return (
    <section className={`table-section ${styles.section}`} aria-labelledby="menu-qr-title">
      <div className="table-title">
        <div>
          <span className="overline">LISTO PARA CADA MESA</span>
          <h2 id="menu-qr-title">QR de tu carta</h2>
        </div>
        <span className={styles.included}><QrCode size={15} /> Incluido en ambos planes</span>
      </div>
      <p className={styles.intro}>Descargá el código de {restaurantName} para ponerlo en tus mesas, en el mostrador o en tus redes.</p>
      {error ? (
        <div className="form-error" role="alert">
          {error} <button type="button" className="link-button" onClick={() => setRetry((value) => value + 1)}>Reintentar</button>
        </div>
      ) : !files ? <div className={styles.loading} role="status">Generando tu QR…</div> : (
        <div className={styles.layout}>
          <div className={styles.preview}>
            <img src={files.png} width={240} height={240} alt={`Código QR para abrir la carta de ${restaurantName}`} />
            <strong>{restaurantName}</strong>
            <span>Escaneá para ver nuestra carta</span>
          </div>
          <div className={styles.content}>
            <h3>Un enlace, siempre actualizado.</h3>
            <p>Cuando cambiás productos, precios o colores, este QR sigue funcionando. Podés usar el mismo código sin volver a imprimirlo.</p>
            <div className={styles.actions}>
              <a className="button button-dark" href={files.png} download={`qr-${slug}.png`}><Download size={17} /> Descargar PNG</a>
              <a className="button button-outline" href={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(files.svg)}`} download={`qr-${slug}.svg`}><Download size={17} /> Descargar SVG</a>
            </div>
            <p className={styles.formatNote}>PNG de 1200 × 1200 px para compartir. SVG para imprimir en cualquier tamaño. Conservá el margen blanco alrededor del código.</p>
            <label className={styles.linkLabel} htmlFor="public-menu-link">ENLACE DE TU CARTA</label>
            <div className={styles.linkRow}>
              <input id="public-menu-link" readOnly value={files.url} onFocus={(event) => event.currentTarget.select()} />
              <button type="button" className="mini-button" onClick={copyLink}>{copied ? <Check size={15} /> : <Copy size={15} />} {copied ? "Copiado" : "Copiar"}</button>
            </div>
            {copyNotice && <p className={styles.copyNotice} role="status">{copyNotice}</p>}
            <a className={styles.openLink} href={files.url} target="_blank" rel="noopener noreferrer">Abrir mi carta <ExternalLink size={14} /></a>
          </div>
        </div>
      )}
    </section>
  );
}
