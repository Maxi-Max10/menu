"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { api } from "@/lib/client";
import { formatMoney, type Order, type OrderStatus } from "@/lib/types";

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
  const load = useCallback(async () => {
    try {
      const result = await api<{ orders: Order[] }>("/api/orders");
      setOrders(result.orders);
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
      setOrders((current) => current.map((item) => item.id === order.id ? { ...item, status } : item));
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "No se pudo actualizar el pedido.");
    } finally {
      setBusyId(null);
    }
  }

  const pending = orders.filter((order) => order.status === "new" || order.status === "preparing").length;
  const total = orders.filter((order) => order.status !== "canceled").reduce((sum, order) => sum + order.total, 0);

  return <section className="orders-section">
    <div className="table-title"><div><span className="overline">PLAN PREMIUM</span><h2>Pedidos de hoy</h2></div><button type="button" className="mini-button" onClick={() => void load()}><RefreshCw size={15} /> Actualizar</button></div>
    <p className="orders-help">Los pedidos se actualizan automáticamente cada 20 segundos. El total lo calcula Polo con los precios de la carta al momento del pedido.</p>
    {!enabled && <div className="orders-disabled">Los pedidos están desactivados. Podés habilitarlos en «Identidad del local».</div>}
    <div className="orders-summary"><div><span>PEDIDOS</span><strong>{orders.length}</strong></div><div><span>POR PREPARAR</span><strong>{pending}</strong></div><div><span>IMPORTE EN PEDIDOS</span><strong>{formatMoney(total)}</strong></div></div>
    {error && <div className="form-error" role="alert">{error}</div>}
    {loading ? <div className="table-empty">Cargando pedidos…</div> : orders.length === 0 ? <div className="table-empty">Todavía no llegaron pedidos hoy. Cuando un cliente confirme uno desde la carta, aparecerá acá.</div> : <div className="orders-list">
      {orders.map((order) => <article className="order-card" key={order.id}>
        <div className="order-card-head"><div><span>#{order.id.slice(0, 8).toUpperCase()} · {new Date(order.created_at).toLocaleTimeString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", hour: "2-digit", minute: "2-digit" })}</span><h3>{order.customer_name}</h3><a href={`tel:${order.customer_phone.replace(/[^+\d]/g, "")}`}>{order.customer_phone}</a></div><strong>{formatMoney(order.total)}</strong></div>
        <ul>{order.items.map((item, index) => <li key={`${item.product_id || item.product_name}-${index}`}><span>{item.quantity} × {item.product_name}</span><strong>{formatMoney(item.line_total)}</strong></li>)}</ul>
        {order.notes && <p className="order-notes"><strong>Indicaciones:</strong> {order.notes}</p>}
        <div className="order-card-foot"><label>Estado <select aria-label={`Estado del pedido ${order.id.slice(0, 8)}`} value={order.status} disabled={busyId === order.id} onChange={(event) => void updateStatus(order, event.target.value as OrderStatus)}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><span>Total del pedido</span></div>
      </article>)}
    </div>}
  </section>;
}
