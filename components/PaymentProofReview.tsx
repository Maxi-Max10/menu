"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client";
import { PLANS, type Plan } from "@/lib/types";

type Proof = { id: string; restaurant_name: string; owner_email: string; period_due_at: string; plan: Plan;
  filename: string; status: "pending" | "rejected" | "approved"; submitted_at: string; current_period: boolean };

export function PaymentProofReview({ onReviewed }: { onReviewed: () => Promise<void> }) {
  const [proofs, setProofs] = useState<Proof[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try { const result = await api<{ proofs: Proof[] }>("/api/admin/payment-proofs"); setProofs(result.proofs); }
    catch (issue) { setError(issue instanceof Error ? issue.message : "No se pudieron cargar los comprobantes."); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  async function review(proof: Proof, action: "approve" | "reject") {
    const question = action === "approve"
      ? `¿Verificaste en Mercado Pago el pago de ${proof.restaurant_name} para la cuota del ${new Date(proof.period_due_at).toLocaleDateString("es-AR")}? Se acreditará un mes.`
      : `¿Rechazar el comprobante de ${proof.restaurant_name}? El local podrá subir otro.`;
    if (!window.confirm(question)) return;
    setBusy(true); setError("");
    try {
      await api(`/api/admin/payment-proofs/${proof.id}`, { method: "PATCH", body: JSON.stringify({ action }) });
      await Promise.all([load(), onReviewed()]);
    } catch (issue) { setError(issue instanceof Error ? issue.message : "No se pudo revisar el comprobante."); }
    finally { setBusy(false); }
  }
  const pending = proofs.filter((proof) => proof.status === "pending");
  return <section className="table-section payment-proof-section" aria-labelledby="pending-proofs-heading">
    <div className="table-title"><div><span className="overline">PAGOS MANUALES</span><h2 id="pending-proofs-heading">Comprobantes pendientes</h2></div><span>{pending.length} pendientes</span></div>
    <p>Compará cada comprobante con el movimiento en tu cuenta de Mercado Pago antes de aprobarlo. El archivo por sí solo no confirma el pago.</p>
    {error && <p className="form-error" role="alert">{error}</p>}
    {!pending.length ? <p>No hay comprobantes pendientes.</p> : <div className="proof-review-list">{pending.map((proof) => <div className="proof-review-item" key={proof.id}>
      <div><strong>{proof.restaurant_name}</strong><small>{proof.owner_email} · Plan {PLANS[proof.plan].label} · Cuota del {new Date(proof.period_due_at).toLocaleDateString("es-AR")}</small><small>Subido el {new Date(proof.submitted_at).toLocaleString("es-AR")}</small></div>
      <div className="row-actions"><a className="mini-button" href={`/api/admin/payment-proofs/${proof.id}/file`} target="_blank" rel="noopener noreferrer">Descargar comprobante</a>
        <button className="mini-button" disabled={busy} onClick={() => review(proof, "reject")}>Rechazar</button>
        <button className="button button-dark" disabled={busy || !proof.current_period} title={!proof.current_period ? "La cuota del local cambió" : ""} onClick={() => review(proof, "approve")}>Aprobar y acreditar</button></div>
    </div>)}</div>}
  </section>;
}
