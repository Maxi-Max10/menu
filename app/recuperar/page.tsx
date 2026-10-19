import type { Metadata } from "next";
import { RecoveryForm } from "./RecoveryForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Recuperar contraseña · Polo", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function RecoveryPage({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  const { token } = await searchParams;
  const recoveryToken = typeof token === "string" ? token.slice(0, 2048) : null;
  return <RecoveryForm key={recoveryToken || "request"} token={recoveryToken} />;
}
