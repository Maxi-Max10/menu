"use client";

import { useEffect, useState, type FormEvent } from "react";
import { api } from "@/lib/client";
import type { Restaurant } from "@/lib/types";

type Proof = { status: "pending" | "rejected" | "approved"; submitted_at: string };

export function PaymentProofUpload({ restaurant }: { restaurant: Restaurant }) {
  const [proof, setProof] = useState<Proof | null>(null);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let active = true;
    api<{ proof: Proof | null; paymentUrl: string | null }>("/api/payment-proof")
      .then((result) => { if (active) { setProof(result.proof); setPaymentUrl(result.paymentUrl); } })
      .catch((issue) => { if (active) setError(issue instanceof Error ? issue.message : "No se pudo consultar el comprobante."); })
      .finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, [restaurant.paid_until]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!file) return;
    setBusy(true); setError("");
    try {
      if (file.size > 4 * 1024 * 1024) throw new Error("El archivo no puede superar 4 MB.");
      const form = new FormData();
      form.set("proof", file);
      const response = await fetch("/api/payment-proof", { method: "POST", body: form });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "No se pudo subir el comprobante.");
      setProof({ status: "pending", submitted_at: new Date().toISOString() });
      setFile(null);
    } catch (issue) { setError(issue instanceof Error ? issue.message : "No se pudo subir el comprobante."); }
    finally { setBusy(false); }
  }

  const due = restaurant.signup_status === "active" && restaurant.paid_until && new Date(restaurant.paid_until).getTime() <= Date.now();
  if (!due) return null;
  return <section className="table-section payment-proof-section" aria-labelledby="payment-proof-heading">
    <div className="table-title"><div><span className="overline">TU CUOTA</span><h2 id="payment-proof-heading">Pago y comprobante</h2></div></div>
    <p>Pagá con Mercado Pago y después subí el comprobante acá para que podamos verificar tu pago.</p>
    {paymentUrl && <p><a className="button button-dark" href={paymentUrl} target="_blank" rel="noopener noreferrer">Pagar con Mercado Pago</a></p>}
    {loaded && !paymentUrl && <p>El enlace de pago todavía no está configurado. Contactá a Polo antes de pagar.</p>}
    {!loaded ? <p>Consultando comprobante…</p> : proof?.status === "pending" ?
      <p role="status"><strong>Comprobante recibido.</strong> Está pendiente de revisión. Tu cuota se acreditará cuando confirmemos el pago en Mercado Pago.</p> :
      proof?.status === "approved" ? <p role="status">Comprobante aprobado.</p> :
      <form onSubmit={submit} className="payment-proof-form">
        {proof?.status === "rejected" && <p role="status">El comprobante anterior no pudo verificarse. Revisá el pago y subí uno nuevo.</p>}
        <label>Comprobante de pago (JPG, PNG o PDF, hasta 4 MB)
          <input type="file" required accept="image/jpeg,image/png,application/pdf" onChange={(event) => setFile(event.target.files?.[0] || null)} />
        </label>
        <button className="button button-dark" disabled={busy || !file}>{busy ? "Subiendo…" : "Enviar comprobante"}</button>
      </form>}
    {error && <p className="form-error" role="alert">{error}</p>}
  </section>;
}
