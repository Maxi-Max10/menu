import { Suspense } from "react";
import { VerifyContent } from "./verify-content";

export default function VerifyPage() {
  return <Suspense fallback={<main className="verify-page">Cargando…</main>}><VerifyContent /></Suspense>;
}
