"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Eye, EyeOff, LockKeyhole } from "lucide-react";
import { Brand } from "@/components/Brand";
import { api } from "@/lib/client";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const result = await api<{ role: "admin" | "restaurant" }>("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
      router.push(result.role === "admin" ? "/admin" : "/panel");
      router.refresh();
    } catch (issue) { setError(issue instanceof Error ? issue.message : "No se pudo ingresar"); }
    finally { setBusy(false); }
  }
  return <main className="auth-page"><div className="auth-aside"><Brand light /><div><span className="overline">TU CARTA EMPIEZA ACÁ</span><h1>Las buenas ideas también se sirven.</h1><p>Entrá para administrar tu local y mantener tu carta siempre lista.</p></div><span>✳ mesa.</span></div><div className="auth-content"><Link href="/" className="back-link"><ArrowLeft size={17} /> Volver al inicio</Link><form className="auth-card" onSubmit={submit}><div className="auth-icon"><LockKeyhole size={24} /></div><span className="overline">BIENVENIDO DE NUEVO</span><h2>Ingresá a tu espacio.</h2><p>Usá el correo y la contraseña de tu cuenta.</p><label>Correo electrónico<input type="email" autoComplete="email" required placeholder="tu@correo.com" value={email} onChange={(event) => setEmail(event.target.value)} /></label><label>Contraseña<div className="password-field"><input type={show ? "text" : "password"} autoComplete="current-password" required placeholder="Tu contraseña" value={password} onChange={(event) => setPassword(event.target.value)} /><button type="button" onClick={() => setShow(!show)} aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}>{show ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>{error && <div className="form-error" role="alert">{error}</div>}<button className="button button-dark auth-submit" disabled={busy}>{busy ? "Ingresando…" : "Ingresar"}<ArrowRight size={18} /></button></form></div></main>;
}
