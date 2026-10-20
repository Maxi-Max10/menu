"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Save } from "lucide-react";
import { api } from "@/lib/client";
import { formatMoney, PLANS } from "@/lib/types";

type Links = { basic: string; premium: string };

export function BillingSettings() {
  const edited = useRef(false);
  const [links, setLinks] = useState<Links>({ basic: "", premium: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    void api<Links>("/api/admin/billing").then((saved) => { if (!edited.current) setLinks(saved); }).catch((issue) => {
      setError(issue instanceof Error ? issue.message : "No se pudieron cargar los enlaces de pago.");
    });
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError(""); setNotice("");
    try {
      await api("/api/admin/billing", { method: "PATCH", body: JSON.stringify(links) });
      setNotice("Enlaces de Mercado Pago guardados.");
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "No se pudieron guardar los enlaces.");
    } finally { setBusy(false); }
  }

  return <section className="table-section billing-settings">
    <div className="table-title"><div><span className="overline">COBRO MENSUAL</span><h2>Enlaces de Mercado Pago</h2></div></div>
    <p>Cargá un Link de pago de monto fijo para cada plan. El aviso por correo incluirá un botón y un QR que abren ese enlace. El pago se acredita manualmente después de comprobarlo.</p>
    <form onSubmit={save}>
      <div className="form-grid">
        <label>Esencial · {formatMoney(PLANS.basic.price)}<input type="url" maxLength={500} placeholder="https://mpago.la/..." value={links.basic} onChange={(event) => { edited.current = true; setLinks((old) => ({ ...old, basic: event.target.value })); }} /></label>
        <label>Premium · {formatMoney(PLANS.premium.price)}<input type="url" maxLength={500} placeholder="https://mpago.la/..." value={links.premium} onChange={(event) => { edited.current = true; setLinks((old) => ({ ...old, premium: event.target.value })); }} /></label>
      </div>
      {error && <div className="form-error" role="alert">{error}</div>}
      {notice && <div className="form-success" role="status">{notice}</div>}
      <button className="button button-dark" disabled={busy}><Save size={16} /> {busy ? "Guardando…" : "Guardar enlaces"}</button>
    </form>
  </section>;
}
