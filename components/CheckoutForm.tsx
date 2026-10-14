"use client";

import { useState, type FormEvent } from "react";
import { ArrowUpRight } from "lucide-react";
import { api } from "@/lib/client";
import { formatMoney, type Product } from "@/lib/types";

export function CheckoutForm({ restaurantId, items, total, demo, onSuccess }: {
  restaurantId: string;
  items: { product: Product; quantity: number }[];
  total: number;
  demo: boolean;
  onSuccess: (id: string | null) => void;
}) {
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (demo) { onSuccess(null); return; }
    setBusy(true);
    setError("");
    try {
      const result = await api<{ id: string }>("/api/orders", { method: "POST", body: JSON.stringify({
        restaurantId, customerName, customerPhone, notes,
        items: items.map(({ product, quantity }) => ({ productId: product.id, quantity })),
      }) });
      onSuccess(result.id);
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "No se pudo enviar el pedido. Probá de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return <form className="cart-bottom checkout-form" onSubmit={submit}>
    <div className="cart-total"><span>Total estimado</span><strong>{formatMoney(total)}</strong></div>
    <label>Tu nombre<input required minLength={2} maxLength={80} autoComplete="name" value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="Nombre para el pedido" /></label>
    <label>Tu teléfono<input type="tel" required minLength={8} maxLength={30} autoComplete="tel" value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} placeholder="+54 9 11 1234-5678" /></label>
    <label>Indicaciones (opcional)<textarea rows={2} maxLength={300} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Por ejemplo, sin cebolla" /></label>
    {error && <div className="form-error" role="alert">{error}</div>}
    <button className="button button-dark" disabled={busy}>{busy ? "Enviando…" : demo ? "Simular pedido" : "Confirmar pedido"}<ArrowUpRight size={17} /></button>
    <p>{demo ? "Es una simulación: el pedido no se enviará a ningún local." : "El local recibirá el pedido en Polo y confirmará disponibilidad e importe final."}</p>
  </form>;
}
