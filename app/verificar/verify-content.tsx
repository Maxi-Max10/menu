"use client";

import { useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Brand } from "@/components/Brand";
import { api } from "@/lib/client";

export function VerifyContent() {
  const token = useSearchParams().get("token");
  const [password, setPassword] = useState("");
  const [state, setState] = useState<"ready" | "loading" | "success" | "error">("ready");
  const [message, setMessage] = useState("");
  function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) { setState("error"); setMessage("Falta el enlace de confirmación."); return; }
    setState("loading");
    api("/api/auth/verify", { method: "POST", body: JSON.stringify({ token, password }) })
      .then(() => setState("success"))
      .catch((issue) => { setState("error"); setMessage(issue instanceof Error ? issue.message : "No se pudo verificar el correo"); });
  }
  return <main className="verify-page"><Brand /><div className="verify-card">{state === "ready" ? <form onSubmit={verify}><h1>Confirmá tu correo</h1><p>Ingresá la contraseña que creaste al registrarte para activar tu cuenta y comenzar el mes gratis.</p><label className="verify-password">Contraseña<input type="password" required autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label><button className="button button-dark">Confirmar y activar</button></form> : state === "loading" ? <><h1>Confirmando tu correo…</h1><p>Un momento, estamos activando tu cuenta.</p></> : state === "success" ? <><h1>¡Tu cuenta está lista!</h1><p>Tu primer mes gratis empieza hoy. Ingresá para preparar la carta de tu local.</p><Link href="/ingresar" className="button button-dark">Ingresar</Link></> : <><h1>No pudimos confirmar el correo</h1><p>{message}</p><p>Contactá a Polo para revisar tu solicitud.</p></>}</div></main>;
}
