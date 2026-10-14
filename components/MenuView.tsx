"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, CakeSlice, Coffee, Instagram, MapPin, Minus, Plus, Search, ShoppingBag, X } from "lucide-react";
import { Brand } from "@/components/Brand";
import { BrandMark } from "@/components/BrandMark";
import { formatMoney, PALETTES, sellingPrice, type Product, type Restaurant } from "@/lib/types";

export function MenuView({ restaurant, products, demo = false }: { restaurant: Restaurant; products: Product[]; demo?: boolean }) {
  const [category, setCategory] = useState("Todo");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [cartOpen, setCartOpen] = useState(false);
  const [demoCopied, setDemoCopied] = useState(false);
  const viewed = useRef(new Set<string>());
  const premium = restaurant.plan === "premium";
  const canOrder = premium && (demo || (restaurant.orders_enabled && !!restaurant.whatsapp.replace(/\D/g, "")));
  const categories = ["Todo", ...new Set(products.map((p) => p.category))];
  const shown = useMemo(() => products.filter((p) => (category === "Todo" || p.category === category) && `${p.name} ${p.description}`.toLowerCase().includes(search.toLowerCase())).sort((a, b) => Number(premium && b.featured) - Number(premium && a.featured)), [products, category, search, premium]);
  const cartItems = products.filter((p) => cart[p.id] > 0).map((product) => ({ product, quantity: cart[product.id] }));
  const itemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const total = cartItems.reduce((sum, item) => sum + sellingPrice(item.product) * item.quantity, 0);
  const message = `Hola, quiero pedir en ${restaurant.name}:\n\n${cartItems.map(({ product, quantity }) => `${quantity} × ${product.name} — ${formatMoney(sellingPrice(product) * quantity)}`).join("\n")}\n\nTotal estimado: ${formatMoney(total)}\n\n¿Me confirman disponibilidad y cómo seguimos?`;
  const orderHref = `https://wa.me/${restaurant.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
  const palette = PALETTES[restaurant.palette] || PALETTES.oliva;

  function track(kind: "visit" | "product_view" | "order_click", productId?: string) {
    if (!premium || demo) return;
    void fetch("/api/menu-events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ restaurantId: restaurant.id, kind, productId: productId || null }), keepalive: true }).catch(() => {});
  }

  useEffect(() => { track("visit"); }, [restaurant.id, premium, demo]);

  useEffect(() => {
    if (!premium || demo || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const id = (entry.target as HTMLElement).dataset.productId;
        if (id && !viewed.current.has(id)) { viewed.current.add(id); track("product_view", id); }
        observer.unobserve(entry.target);
      }
    }, { threshold: 0.5 });
    document.querySelectorAll<HTMLElement>(".menu-product[data-product-id]").forEach((element) => { if (!viewed.current.has(element.dataset.productId || "")) observer.observe(element); });
    return () => observer.disconnect();
  }, [shown, premium, demo]);

  useEffect(() => {
    if (!cartOpen) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setCartOpen(false); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [cartOpen]);

  function adjust(id: string, amount: number) {
    setCart((old) => ({ ...old, [id]: Math.max(0, Math.min(99, (old[id] || 0) + amount)) }));
  }

  async function copyDemo() {
    try { await navigator.clipboard.writeText(message); setDemoCopied(true); }
    catch { setDemoCopied(false); }
  }

  return <div className="menu-page" style={{ "--menu-primary": palette.primary, "--menu-accent": palette.accent } as React.CSSProperties}>
    {demo && <div className="demo-ribbon"><span>VISTA DE EJEMPLO · PLAN {premium ? "PREMIUM" : "ESENCIAL"}</span><Link href="/"><ArrowLeft size={15} /> Volver a Polo.</Link></div>}
    <header className="menu-topbar"><div className="menu-wrap menu-topbar-inner"><span>LA CARTA</span><span>HECHA PARA DISFRUTAR <BrandMark /></span></div></header>
    <section className="menu-cover"><div className="menu-wrap menu-cover-inner"><div className="menu-logo">{restaurant.logo_data ? <img src={restaurant.logo_data} alt={`Logo de ${restaurant.name}`} /> : restaurant.name.split(" ").map((word) => word[0]).slice(0, 2).join("")}</div><div className="menu-cover-copy"><span className="menu-kicker">BIENVENIDOS A</span><h1>{restaurant.name}</h1><p>{restaurant.description || "Un momento para disfrutar."}</p></div><BrandMark className="menu-cover-mark" /></div></section>
    <main className="menu-wrap menu-main"><div className="menu-heading"><div><span className="overline">EXPLORÁ NUESTRA CARTA</span><h2>Elegí algo <em>rico.</em></h2></div><div className="menu-search"><Search size={19} /><input aria-label="Buscar productos" placeholder="Buscar en la carta" value={search} onChange={(event) => setSearch(event.target.value)} /></div></div><div className="category-tabs" role="tablist" aria-label="Categorías">{categories.map((item) => <button role="tab" aria-selected={category === item} className={category === item ? "active" : ""} key={item} onClick={() => setCategory(item)}>{item}</button>)}</div><div className="menu-products">{shown.length ? shown.map((product, index) => {
      const promotional = premium && product.promo_price !== null && product.promo_price < product.price;
      return <article className="menu-product" data-product-id={product.id} key={product.id}><div className={`menu-product-art art-${index % 4}`}>{product.image_data ? <img src={product.image_data} alt={product.name} /> : product.category === "Bebidas" ? <Coffee /> : product.category === "Postres" ? <CakeSlice /> : <BrandMark />}</div><div className="menu-product-body"><div className="menu-product-labels"><span className="product-category">{product.category}</span>{premium && product.featured && <span className="product-badge">Destacado</span>}{promotional && <span className="product-badge promo">Oferta</span>}</div><h3>{product.name}</h3><p>{product.description}</p><div className="menu-product-foot"><div className="menu-price">{promotional && <s>{formatMoney(product.price)}</s>}<strong>{formatMoney(premium ? sellingPrice(product) : product.price)}</strong></div>{canOrder && <button type="button" className="add-to-cart" onClick={() => adjust(product.id, 1)}><Plus size={16} /> Agregar</button>}</div></div></article>;
    }) : <div className="empty-products">No encontramos productos con esa búsqueda.</div>}</div></main>
    <footer className="menu-footer"><div className="menu-wrap"><div><span>GRACIAS POR ESTAR ACÁ</span><h2>Buen provecho.</h2></div><div className="menu-footer-links">{restaurant.address && <span><MapPin size={16} /> {restaurant.address}</span>}{restaurant.instagram && <a target="_blank" rel="noopener noreferrer" href={`https://instagram.com/${restaurant.instagram.replace(/^@/, "")}`}><Instagram size={16} /> Instagram <ArrowUpRight size={14} /></a>}{restaurant.whatsapp && <a target="_blank" rel="noopener noreferrer" href={`https://wa.me/${restaurant.whatsapp.replace(/\D/g, "")}`}>WhatsApp <ArrowUpRight size={14} /></a>}</div><div className="powered">Carta creada con <Brand light /></div></div></footer>
    {canOrder && <button type="button" className="cart-fab" onClick={() => setCartOpen(true)} aria-label={`Ver pedido, ${itemCount} productos`}><ShoppingBag size={20} /><span>Ver pedido</span><b>{itemCount}</b></button>}
    {cartOpen && <div className="cart-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setCartOpen(false); }}><section className="cart-drawer" role="dialog" aria-modal="true" aria-label="Tu pedido"><div className="cart-head"><div><span className="overline">TU SELECCIÓN</span><h2>Tu pedido</h2></div><button type="button" className="cart-close" aria-label="Cerrar pedido" onClick={() => setCartOpen(false)}><X size={22} /></button></div>{cartItems.length ? <><div className="cart-list">{cartItems.map(({ product, quantity }) => <div className="cart-line" key={product.id}><div><strong>{product.name}</strong><small>{formatMoney(sellingPrice(product))} c/u</small></div><div className="cart-quantity"><button type="button" aria-label={`Quitar ${product.name}`} onClick={() => adjust(product.id, -1)}><Minus size={15} /></button><span>{quantity}</span><button type="button" aria-label={`Agregar ${product.name}`} onClick={() => adjust(product.id, 1)}><Plus size={15} /></button></div></div>)}</div><div className="cart-bottom"><div className="cart-total"><span>Total estimado</span><strong>{formatMoney(total)}</strong></div>{demo ? <button type="button" className="button button-dark" onClick={copyDemo}>{demoCopied ? "Pedido copiado" : "Copiar pedido de ejemplo"}</button> : <a className="button button-dark" href={orderHref} target="_blank" rel="noopener noreferrer" onClick={() => track("order_click")}>Enviar pedido por WhatsApp <ArrowUpRight size={17} /></a>}<p>El local confirmará disponibilidad, importe final y forma de entrega por WhatsApp.</p></div></> : <div className="cart-empty"><ShoppingBag size={32} /><p>Tu pedido está vacío.</p><button type="button" className="button button-outline" onClick={() => setCartOpen(false)}>Seguir eligiendo</button></div>}</section></div>}
  </div>;
}
