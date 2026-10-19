"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle2, KeyRound, Mail } from "lucide-react";
import { Brand } from "@/components/Brand";
import { BrandMark } from "@/components/BrandMark";
import { SupportLinks } from "@/components/SupportLinks";
import { api } from "@/lib/client";
import { passwordSchema } from "@/lib/validation";

export function RecoveryForm({ token }: { token: string | null }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  useEffect(() => { setReady(true); }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (token) {
      const parsed = passwordSchema.safeParse(password);
      if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
      if (password !== confirmation) { setError("Las contraseñas no coinciden"); return; }
    }
    setBusy(true);
    setError("");
    try {
      if (token) {
        await api("/api/auth/password/reset", { method: "POST", body: JSON.stringify({ token, password }) });
        setPassword("");
        setConfirmation("");
      } else {
        const result = await api<{ message: string }>("/api/auth/password/forgot", { method: "POST", body: JSON.stringify({ email }) });
        setMessage(result.message);
      }
      setDone(true);
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "No se pudo completar la solicitud. Probá otra vez.");
    } finally { setBusy(false); }
  }

  return <main className="auth-page">
    <div className="auth-aside">
      <BrandMark className="auth-mark" /><Brand light />
      <div><span className="overline">TU CARTA TE ESPERA</span><h1>Volvé a tu espacio.</h1><p>Recuperá el acceso a tu local y seguí compartiendo lo que hacés.</p></div>
      <span><BrandMark /> polo.</span>
    </div>
    <div className="auth-content">
      <Link href="/ingresar" className="back-link"><ArrowLeft size={17} /> Volver a ingresar</Link>
      {done ? <div className="auth-card" role="status">
        <div className="auth-icon"><CheckCircle2 size={24} /></div>
        <h2>{token ? "Contraseña actualizada." : "Revisá tu correo."}</h2>
        <p>{token ? "Ya podés ingresar con tu correo y la contraseña nueva. Las sesiones anteriores de tu cuenta se cerraron." : message}</p>
        {!token && <p>El enlace dura 30 minutos. Abrilo para elegir tu nueva contraseña.</p>}
        <Link href="/ingresar" className="button button-dark auth-submit">Ir a ingresar <ArrowRight size={18} /></Link>
      </div> : <form className="auth-card" onSubmit={submit}>
        <div className="auth-icon">{token ? <KeyRound size={24} /> : <Mail size={24} />}</div>
        <span className="overline">RECUPERÁ TU ACCESO</span>
        <h2>{token ? "Elegí una contraseña nueva." : "¿Olvidaste tu contraseña?"}</h2>
        <p>{token ? "Usá al menos 10 caracteres. Después del cambio, este enlace dejará de servir." : "Ingresá el correo con el que registraste tu local. Te enviaremos un enlace para crear una contraseña nueva."}</p>
        {token ? <>
          <label>Nueva contraseña<input required type={visible ? "text" : "password"} autoComplete="new-password" minLength={10} maxLength={72} disabled={!ready || busy} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Mínimo 10 caracteres" /></label>
          <label>Repetir nueva contraseña<input required type={visible ? "text" : "password"} autoComplete="new-password" minLength={10} maxLength={72} disabled={!ready || busy} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label>
          <label className="checkbox-label"><input type="checkbox" disabled={!ready || busy} checked={visible} onChange={(event) => setVisible(event.target.checked)} /> Mostrar contraseña</label>
        </> : <label>Correo electrónico<input required type="email" maxLength={254} autoComplete="email" disabled={!ready || busy} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="tu@correo.com" /></label>}
        {error && <div className="form-error" role="alert">{error}</div>}
        <button className="button button-dark auth-submit" disabled={!ready || busy}>{busy ? "Procesando…" : token ? "Guardar nueva contraseña" : "Enviar enlace de recuperación"}<ArrowRight size={18} /></button>
        {token && <p className="register-login"><Link href="/recuperar">Solicitar otro enlace</Link></p>}
      </form>}
      <div className="auth-support"><span>¿Necesitás ayuda?</span><SupportLinks /></div>
    </div>
  </main>;
}
