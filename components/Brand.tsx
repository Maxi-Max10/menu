import Link from "next/link";
import { PoloLogo } from "@/components/PoloLogo";

export function Brand({ light = false }: { light?: boolean }) {
  return <Link className={`brand ${light ? "brand-light" : ""}`} href="/" aria-label="Polo, inicio"><PoloLogo /></Link>;
}
