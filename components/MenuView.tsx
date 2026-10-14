"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Box, Instagram, MapPin, Search, X } from "lucide-react";
import { Brand } from "@/components/Brand";
import { formatMoney, PALETTES, type Product, type Restaurant } from "@/lib/types";
import { ModelViewer } from "@/components/ModelViewer";

export function MenuView({ restaurant, products, demo = false }: { restaurant: Restaurant; products: Product[]; demo?: boolean }) {
  const [category, setCategory] = useState("Todo");
  const [search, setSearch] = useState("");
  const [model, setModel] = useState<Product | null>(null);
  const categories = ["Todo", ...new Set(products.map((p) => p.category))];
  const shown = products.filter((p) => (category === "Todo" || p.category === category) && `${p.name} ${p.description}`.toLowerCase().includes(search.toLowerCase()));
  const palette = PALETTES[restaurant.palette] || PALETTES.oliva;
  return <div className="menu-page" style={{ "--menu-primary": palette.primary, "--menu-accent": palette.accent } as React.CSSProperties}>
    {demo && <div className="demo-ribbon"><span>VISTA DE EJEMPLO</span><Link href="/"><ArrowLeft size={15} /> Volver a Polo.</Link></div>}
    <header className="menu-topbar"><div className="menu-wrap menu-topbar-inner"><span>LA CARTA</span><span>HECHA PARA DISFRUTAR ✳</span></div></header>
    <section className="menu-cover"><div className="menu-wrap menu-cover-inner"><div className="menu-logo">{restaurant.logo_data ? <img src={restaurant.logo_data} alt={`Logo de ${restaurant.name}`} /> : restaurant.name.split(" ").map((word) => word[0]).slice(0, 2).join("")}</div><div><span className="menu-kicker">BIENVENIDOS A</span><h1>{restaurant.name}</h1><p>{restaurant.description || "Un momento para disfrutar."}</p></div><div className="menu-cover-mark">✳</div></div></section>
    <main className="menu-wrap menu-main"><div className="menu-heading"><div><span className="overline">EXPLORÁ NUESTRA CARTA</span><h2>Elegí algo <em>rico.</em></h2></div><div className="menu-search"><Search size={19} /><input aria-label="Buscar productos" placeholder="Buscar en la carta" value={search} onChange={(event) => setSearch(event.target.value)} /></div></div><div className="category-tabs" role="tablist" aria-label="Categorías">{categories.map((item) => <button role="tab" aria-selected={category === item} className={category === item ? "active" : ""} key={item} onClick={() => setCategory(item)}>{item}</button>)}</div><div className="menu-products">{shown.length ? shown.map((product, index) => <article className="menu-product" key={product.id}><div className={`menu-product-art art-${index % 4}`}>{product.image_data ? <img src={product.image_data} alt={product.name} /> : <span>{product.category === "Bebidas" ? "◔" : product.category === "Postres" ? "✺" : "✳"}</span>}</div><div className="menu-product-body"><span className="product-category">{product.category}</span><h3>{product.name}</h3><p>{product.description}</p><div className="menu-product-foot"><strong>{formatMoney(product.price)}</strong>{restaurant.plan === "premium" && product.model_url && <button className="model-button" onClick={() => setModel(product)}><Box size={16} /> Ver en 3D / AR</button>}</div></div></article>) : <div className="empty-products">No encontramos productos con esa búsqueda.</div>}</div></main>
    <footer className="menu-footer"><div className="menu-wrap"><div><span>GRACIAS POR ESTAR ACÁ</span><h2>Buen provecho.</h2></div><div className="menu-footer-links">{restaurant.address && <span><MapPin size={16} /> {restaurant.address}</span>}{restaurant.instagram && <a target="_blank" rel="noopener noreferrer" href={`https://instagram.com/${restaurant.instagram.replace(/^@/, "")}`}><Instagram size={16} /> Instagram <ArrowUpRight size={14} /></a>}{restaurant.whatsapp && <a target="_blank" rel="noopener noreferrer" href={`https://wa.me/${restaurant.whatsapp.replace(/\D/g, "")}`}>WhatsApp <ArrowUpRight size={14} /></a>}</div><div className="powered">Carta creada con <Brand light /></div></div></footer>
    {model && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={`Vista 3D de ${model.name}`}><div className="model-modal"><button className="modal-close" onClick={() => setModel(null)} aria-label="Cerrar"><X size={20} /></button><span className="overline">VISTA 3D / AR</span><h2>{model.name}</h2><ModelViewer src={model.model_url!} alt={model.name} /><p>Arrastrá para girar el modelo. En dispositivos compatibles, tocá el ícono AR para verlo en tu espacio.</p></div></div>}
  </div>;
}
