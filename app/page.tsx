import Link from "next/link";
import { ArrowRight, Check, ChevronRight, Coffee, QrCode, ShoppingBag, Sparkles, Smartphone, UtensilsCrossed } from "lucide-react";
import { Brand } from "@/components/Brand";
import { BrandMark } from "@/components/BrandMark";
import { SupportLinks } from "@/components/SupportLinks";
import { formatMoney, PLANS } from "@/lib/types";

export default function Home() {
  return <main className="landing">
    <header className="site-header wrap">
      <Brand />
      <nav aria-label="Navegación principal"><a href="#como-funciona">Cómo funciona</a><a href="#planes">Planes</a><Link href="/ingresar" className="nav-login">Ingresar <ArrowRight size={16} /></Link></nav>
    </header>

    <section className="hero wrap">
      <div className="hero-copy">
        <div className="eyebrow"><span className="eyebrow-line" /> LA CARTA DE TU LOCAL, A TU MANERA</div>
        <h1>Una carta que abre el <em>apetito.</em></h1>
        <p>Tu menú digital con tus colores, tu logo y toda tu esencia. Fácil de actualizar, simple de compartir y listo para cada mesa.</p>
        <div className="hero-actions"><a href="#planes" className="button button-dark">Conocer los planes <ArrowRight size={18} /></a><Link href="/demo" className="text-link">Ver carta de ejemplo <ChevronRight size={18} /></Link></div>
        <div className="hero-note"><BrandMark className="sparkle" /> Para restaurantes, cafeterías, bares y más.</div>
      </div>
      <div className="hero-visual" aria-label="Vista ilustrativa de una carta digital">
        <div className="orbit orbit-one" /><div className="orbit orbit-two" />
        <div className="float-badge badge-top"><QrCode size={22} /><span>Escaneá.<br /><strong>Descubrí.</strong></span></div>
        <div className="phone-mockup">
          <div className="phone-notch" />
          <div className="mock-header"><div className="mock-logo">ML</div><span>MESA LUMA<small>COCINA DE TODOS LOS DÍAS</small></span></div>
          <div className="mock-hero"><div className="mock-dish"><span className="dish-leaf leaf-one" /><span className="dish-leaf leaf-two" /><span className="dish-leaf leaf-three" /><span className="dish-center" /></div></div>
          <div className="mock-content"><span className="mock-overline">NUESTRA CARTA</span><strong>Algo rico te espera.</strong><div className="mock-chips"><b>Todo</b><span>Para empezar</span><span>Principales</span></div><div className="mock-row"><span>Risotto de hongos<small>Cremoso, con parmesano</small></span><b>$ 16.500</b></div><div className="mock-row"><span>Ensalada de estación<small>Fresco de la huerta</small></span><b>$ 12.000</b></div></div>
        </div>
        <div className="float-badge badge-bottom"><span className="badge-star"><Sparkles size={28} /></span><span>Siempre<br /><strong>actualizada</strong></span></div>
      </div>
    </section>

    <section className="benefit-band"><div className="wrap benefit-grid"><div><span>01 / IDENTIDAD</span><strong>Se siente como tu local.</strong></div><div><span>02 / SIMPLICIDAD</span><strong>Editás todo en minutos.</strong></div><div><span>03 / EXPERIENCIA</span><strong>Tu carta, en cada mesa.</strong></div></div></section>

    <section className="section steps wrap" id="como-funciona"><div className="section-intro"><span className="overline">ASÍ DE SIMPLE</span><h2>Del mostrador<br />a la pantalla.</h2><p>Todo lo que necesitás para que tu carta esté donde están tus clientes.</p></div><div className="steps-list"><div className="step"><div className="step-icon"><UtensilsCrossed size={24} /></div><div><span>01</span><h3>Armá tu espacio</h3><p>Elegí entre colores predefinidos, agregá tu logo y contá qué hace especial a tu local.</p></div></div><div className="step"><div className="step-icon"><Coffee size={24} /></div><div><span>02</span><h3>Cargá tus productos</h3><p>Organizá platos y bebidas por categoría, con fotos, descripciones y precios.</p></div></div><div className="step"><div className="step-icon"><Smartphone size={24} /></div><div><span>03</span><h3>Compartí tu carta</h3><p>Descargá tu QR para las mesas y compartí el enlace en tus redes o por mensaje.</p></div></div></div></section>

    <section className="feature-section"><div className="wrap feature-grid"><div className="feature-art"><div className="feature-circle"><div className="feature-card card-back">TU MENÚ <span><BrandMark /></span></div><div className="feature-card card-front"><span className="feature-card-kicker">DEL ANTOJO AL PEDIDO</span><div className="feature-plate"><ShoppingBag size={68} strokeWidth={1.2} /></div><strong>Elegí.<br />Pedí.</strong><small>Disponible en Premium</small></div></div></div><div className="feature-copy"><span className="overline">PLAN PREMIUM</span><h2>Una carta que también recibe pedidos.</h2><p>Tus clientes arman su pedido desde el celular y te lo envían por WhatsApp. Destacá platos, creá promociones y mirá qué productos despiertan más interés.</p><a href="#planes" className="text-link">Explorar Premium <ArrowRight size={18} /></a></div></div></section>

    <section className="section pricing wrap" id="planes"><div className="pricing-head"><div><span className="overline">PRECIOS CLAROS</span><h2>Un plan para<br /><em>cada mesa.</em></h2></div><p>El primer mes es gratis en ambos planes para locales nuevos. Después, pagás la cuota mensual en pesos argentinos.</p></div><div className="pricing-grid"><article className="price-card"><div className="price-top"><span className="plan-mark"><UtensilsCrossed size={19} /></span><span>PARA EMPEZAR</span></div><h3>Esencial</h3><p>Una carta digital linda, clara y siempre al día.</p><div className="price">{formatMoney(PLANS.basic.price)} <span>/ mes desde el segundo mes</span></div><span className="trial-badge">Primer mes gratis</span><ul><li><Check size={17} /> Hasta 100 productos</li><li><Check size={17} /> Fotos, precios y categorías</li><li><Check size={17} /> Logo y colores predefinidos</li><li><Check size={17} /> QR descargable y enlace público</li></ul><Link href="/registrarse/esencial" className="button button-dark">Empezar gratis <ArrowRight size={17} /></Link><Link href="/demo/esencial" className="pricing-demo-link">Ver carta Esencial</Link></article><article className="price-card price-featured"><div className="price-top"><span className="plan-mark"><Sparkles size={19} /></span><span>PARA VENDER MÁS</span></div><h3>Premium</h3><p>Recibí pedidos y conocé mejor a tus clientes.</p><div className="price">{formatMoney(PLANS.premium.price)} <span>/ mes desde el segundo mes</span></div><span className="trial-badge">Primer mes gratis</span><ul><li><Check size={17} /> Hasta 200 productos</li><li><Check size={17} /> Todo lo del plan Esencial</li><li><Check size={17} /> Carrito y pedidos por WhatsApp</li><li><Check size={17} /> Productos destacados y promociones</li><li><Check size={17} /> Visitas, platos vistos y clics para pedir</li></ul><Link href="/registrarse/premium" className="button button-cream">Empezar gratis <ArrowRight size={17} /></Link><Link href="/demo" className="pricing-demo-link">Probar carta Premium</Link></article></div><p className="pricing-footnote">Creá tu cuenta desde el plan que elijas. El mes gratis comienza al activar tu cuenta; las cuotas posteriores se acreditan manualmente.</p></section>

    <footer className="footer"><div className="wrap footer-inner"><div><Brand light /><p>Buenas cartas. Mejores encuentros.</p></div><div><Link href="/demo">Carta de ejemplo</Link><Link href="/ingresar">Ingresar</Link><a href="#planes">Planes</a></div><div className="footer-support"><strong>Soporte Polo</strong><SupportLinks /></div><span>© {new Date().getFullYear()} polo.</span></div></footer>
  </main>;
}
