"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle2, LockKeyhole } from "lucide-react";
import { Brand } from "@/components/Brand";
import { BrandMark } from "@/components/BrandMark";
import { api } from "@/lib/client";
import { formatMoney, PLANS, type Plan, type VenueType } from "@/lib/types";

export function RegisterForm({ plan }: { plan: Plan }) {
  const [name, setName] = useState("");
  const [type, setType] = useState<VenueType>("Restaurante");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const chosen = PLANS[plan];
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password !== confirm) { setError("Las contraseñas no coinciden"); return; }
    setBusy(true); setError("");
    try { await api("/api/auth/register", { method: "POST", body: JSON.stringify({ name, type, plan, email, password }) }); setDone(true); }
    catch (issue) { setError(issue instanceof Error ? issue.message : "No se pudo enviar la solicitud"); }
    finally { setBusy(false); }
  }
  return <main className="auth-page"><div className="auth-aside"><BrandMark className="auth-mark" /><Brand light /><div><span className="overline">TU CARTA EMPIEZA ACÁ</span><h1>Hacé lugar para algo bueno.</h1><p>Creá la cuenta de tu local y prepará una carta lista para compartir.</p></div><span><BrandMark /> polo.</span></div><div className="auth-content"><Link href="/#planes" className="back-link"><ArrowLeft size={17} /> Volver a los planes</Link>{done ? <div className="auth-card"><div className="auth-icon"><CheckCircle2 size={24} /></div><span className="overline">SOLICITUD RECIBIDA</span><h2>Ya casi está.</h2><p>Si tu correo es nuevo, te enviamos un enlace para confirmarlo y activar tu mes gratis. Si el correo automático no está disponible, Polo revisará tu solicitud y activará tu cuenta.</p><Link href="/ingresar" className="button button-dark auth-submit">Ir a ingresar <ArrowRight size={18} /></Link></div> : <form className="auth-card" onSubmit={submit}><div className="auth-icon"><LockKeyhole size={24} /></div><span className="overline">PLAN {chosen.label.toUpperCase()}</span><h2>Creá tu cuenta.</h2><p>Primer mes gratis. Después, {formatMoney(chosen.price)} por mes. La prueba empieza cuando confirmás tu correo o Polo activa tu cuenta.</p><label>Nombre del local<input required minLength={2} maxLength={80} autoComplete="organization" value={name} onChange={(event) => setName(event.target.value)} placeholder="Ej. Café del Parque" /></label><label>Tipo de local<select value={type} onChange={(event) => setType(event.target.value as VenueType)}><option>Restaurante</option><option>Cafetería</option><option>Bar</option><option>Otro</option></select></label><label>Correo electrónico<input type="email" required maxLength={254} autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="tu@correo.com" /></label><label>Contraseña<input type="password" required minLength={10} maxLength={72} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Mínimo 10 caracteres" /></label><label>Repetir contraseña<input type="password" required minLength={10} maxLength={72} autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} /></label>{error && <div className="form-error" role="alert">{error}</div>}<button className="button button-dark auth-submit" disabled={busy}>{busy ? "Creando cuenta…" : "Empezar gratis"}<ArrowRight size={18} /></button><p className="register-login">¿Ya tenés cuenta? <Link href="/ingresar">Ingresá</Link></p></form>}</div></main>;
}
