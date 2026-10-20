"use client";

import { useState, type FormEvent } from "react";
import { ArrowUpRight } from "lucide-react";
import { api } from "@/lib/client";
import { DELIVERY_LABELS, formatMoney, PAYMENT_LABELS, type DeliveryMethod, type PaymentMethod, type Product } from "@/lib/types";

export function CheckoutForm({ restaurantId, items, total, demo, onSuccess }: {
  restaurantId: string;
  items: { product: Product; quantity: number }[];
  total: number;
  demo: boolean;
  onSuccess: (id: string | null) => void;
}) {
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod | "">("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "">("");
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
        restaurantId, customerName, customerPhone, deliveryMethod,
        deliveryAddress: deliveryMethod === "delivery" ? deliveryAddress : "", paymentMethod, notes,
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
    <div className="cart-total"><span>Subtotal estimado</span><strong>{formatMoney(total)}</strong></div>
    <label>Tu nombre<input required minLength={2} maxLength={80} autoComplete="name" value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="Nombre para el pedido" /></label>
    <label>Tu teléfono<input type="tel" required minLength={8} maxLength={30} autoComplete="tel" value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} placeholder="+54 9 11 1234-5678" /></label>
    <label>¿Delivery o retirás?<select required value={deliveryMethod} onChange={(event) => setDeliveryMethod(event.target.value as DeliveryMethod | "")}><option value="">Elegí una opción</option>{Object.entries(DELIVERY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    {deliveryMethod === "delivery" && <label>Dirección de entrega<input required minLength={5} maxLength={180} autoComplete="street-address" value={deliveryAddress} onChange={(event) => setDeliveryAddress(event.target.value)} placeholder="Calle, número y localidad" /></label>}
    <label>Medio de pago preferido<select required value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod | "")}><option value="">Elegí una opción</option>{Object.entries(PAYMENT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    <label>Indicaciones (opcional)<textarea rows={2} maxLength={300} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Por ejemplo, sin cebolla" /></label>
    {error && <div className="form-error" role="alert">{error}</div>}
    <button className="button button-dark" disabled={busy}>{busy ? "Enviando…" : demo ? "Simular pedido" : "Confirmar pedido"}<ArrowUpRight size={17} /></button>
    <p>{demo ? "Es una simulación: el pedido no se enviará a ningún local." : "El local confirmará disponibilidad, importe final, costo de envío si corresponde y medio de pago. Polo no cobra este pedido."}</p>
  </form>;
}
