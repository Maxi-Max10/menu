"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { api } from "@/lib/client";
import { DELIVERY_LABELS, formatMoney, PAYMENT_LABELS, type Order, type OrderStatus } from "@/lib/types";

const statusLabels: Record<OrderStatus, string> = {
  new: "Nuevo",
  preparing: "Preparando",
  ready: "Listo",
  completed: "Entregado",
  canceled: "Cancelado",
};

export function OrdersDashboard({ enabled }: { enabled: boolean }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const completedIds = useRef(new Set<string>());
  const load = useCallback(async () => {
    try {
      const result = await api<{ orders: Order[] }>("/api/orders");
      setOrders(result.orders.filter((order) => !completedIds.current.has(order.id)));
      setError("");
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "No se pudieron cargar los pedidos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => { void load(); }, 20_000);
    return () => window.clearInterval(interval);
  }, [load]);

  async function updateStatus(order: Order, status: OrderStatus) {
    setBusyId(order.id);
    setError("");
    try {
      await api(`/api/orders/${order.id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      if (status === "completed") completedIds.current.add(order.id);
      setOrders((current) => status === "completed"
        ? current.filter((item) => item.id !== order.id)
        : current.map((item) => item.id === order.id ? { ...item, status } : item));
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "No se pudo actualizar el pedido.");
    } finally {
      setBusyId(null);
    }
  }

  const pending = orders.filter((order) => order.status === "new" || order.status === "preparing").length;
  const total = orders.filter((order) => order.status !== "canceled").reduce((sum, order) => sum + order.total, 0);

  return <section className="orders-section">
    <div className="table-title"><div><span className="overline">PLAN PREMIUM</span><h2>Pedidos sin entregar</h2></div><button type="button" className="mini-button" onClick={() => void load()}><RefreshCw size={15} /> Actualizar</button></div>
    <p className="orders-help">Los pedidos permanecen acá hasta que los marques como entregados. Se actualizan automáticamente cada 20 segundos. El importe muestra los productos al precio de la carta; confirmá el costo de envío y el medio de pago con el cliente.</p>
    {!enabled && <div className="orders-disabled">Los pedidos están desactivados. Podés habilitarlos en «Identidad del local».</div>}
    <div className="orders-summary"><div><span>PEDIDOS</span><strong>{orders.length}</strong></div><div><span>POR PREPARAR</span><strong>{pending}</strong></div><div><span>IMPORTE EN PEDIDOS</span><strong>{formatMoney(total)}</strong></div></div>
    {error && <div className="form-error" role="alert">{error}</div>}
    {loading ? <div className="table-empty">Cargando pedidos…</div> : orders.length === 0 ? <div className="table-empty">No hay pedidos sin entregar. Cuando un cliente confirme uno desde la carta, aparecerá acá.</div> : <div className="orders-list">
      {orders.map((order) => <article className="order-card" key={order.id}>
        <div className="order-card-head"><div><span>#{order.id.slice(0, 8).toUpperCase()} · {new Date(order.created_at).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span><h3>{order.customer_name}</h3><a href={`tel:${order.customer_phone.replace(/[^+\d]/g, "")}`}>{order.customer_phone}</a></div><strong>{formatMoney(order.total)}</strong></div>
        <ul>{order.items.map((item, index) => <li key={`${item.product_id || item.product_name}-${index}`}><span>{item.quantity} × {item.product_name}</span><strong>{formatMoney(item.line_total)}</strong></li>)}</ul>
        <div className="order-details"><p><strong>Entrega:</strong> {order.delivery_method ? DELIVERY_LABELS[order.delivery_method] : "Sin especificar"}</p>{order.delivery_method === "delivery" && order.delivery_address && <p><strong>Dirección:</strong> {order.delivery_address}</p>}<p><strong>Medio de pago:</strong> {order.payment_method ? PAYMENT_LABELS[order.payment_method] : "Sin especificar"}</p></div>
        {order.notes && <p className="order-notes"><strong>Indicaciones:</strong> {order.notes}</p>}
        <div className="order-card-foot"><label>Estado <select aria-label={`Estado del pedido ${order.id.slice(0, 8)}`} value={order.status} disabled={busyId === order.id} onChange={(event) => void updateStatus(order, event.target.value as OrderStatus)}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><span>Productos, sin envío</span></div>
      </article>)}
    </div>}
  </section>;
}
