"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Brand } from "@/components/Brand";
import { api } from "@/lib/client";

export function VerifyContent() {
  const token = useSearchParams().get("token");
  const [state, setState] = useState<"ready" | "loading" | "success" | "error">("ready");
  const [message, setMessage] = useState("");
  function verify() {
    if (!token) { setState("error"); setMessage("Falta el enlace de confirmación."); return; }
    setState("loading");
    api("/api/auth/verify", { method: "POST", body: JSON.stringify({ token }) })
      .then(() => setState("success"))
      .catch((issue) => { setState("error"); setMessage(issue instanceof Error ? issue.message : "No se pudo verificar el correo"); });
  }
  return <main className="verify-page"><Brand /><div className="verify-card">{state === "ready" ? <><h1>Confirmá tu correo</h1><p>Al confirmarlo, se activará tu cuenta y comenzará tu mes gratis.</p><button className="button button-dark" onClick={verify}>Confirmar y activar</button></> : state === "loading" ? <><h1>Confirmando tu correo…</h1><p>Un momento, estamos activando tu cuenta.</p></> : state === "success" ? <><h1>¡Tu cuenta está lista!</h1><p>Tu primer mes gratis empieza hoy. Ingresá para preparar la carta de tu local.</p><Link href="/ingresar" className="button button-dark">Ingresar</Link></> : <><h1>No pudimos confirmar el correo</h1><p>{message}</p><p>Contactá a Polo para revisar tu solicitud.</p></>}</div></main>;
}
