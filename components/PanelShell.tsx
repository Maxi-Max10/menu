"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, LayoutDashboard, LogOut, UtensilsCrossed } from "lucide-react";
import { Brand } from "@/components/Brand";
import { BrandMark } from "@/components/BrandMark";
import { api } from "@/lib/client";

export function PanelShell({ children, admin = false, menuHref }: { children: React.ReactNode; admin?: boolean; menuHref?: string }) {
  const router = useRouter();
  async function logout() { await api("/api/auth/logout", { method: "POST" }); router.replace("/ingresar"); router.refresh(); }
  return <div className="panel-layout"><aside className="panel-sidebar"><Brand light /><div className="sidebar-caption">ESPACIO DE TRABAJO</div><nav><Link href={admin ? "/admin" : "/panel"} className="sidebar-link active"><LayoutDashboard size={19} /> {admin ? "Locales" : "Mi carta"}</Link>{menuHref && <Link href={menuHref} target="_blank" className="sidebar-link"><UtensilsCrossed size={19} /> Ver carta <ArrowUpRight size={15} /></Link>}</nav><div className="sidebar-bottom"><div className="sidebar-help"><span><BrandMark /></span><strong>Tu carta, siempre lista.</strong><p>Hacé cambios cuando quieras y se verán al instante.</p></div><button className="sidebar-logout" onClick={logout}><LogOut size={18} /> Cerrar sesión</button></div></aside><div className="panel-main"><div className="panel-mobile-head"><Brand /><button onClick={logout} aria-label="Cerrar sesión"><LogOut size={19} /></button></div>{children}</div></div>;
}
