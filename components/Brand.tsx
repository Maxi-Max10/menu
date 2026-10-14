import Link from "next/link";

export function Brand({ light = false }: { light?: boolean }) {
  return <Link className={`brand ${light ? "brand-light" : ""}`} href="/" aria-label="Polo, inicio"><span className="brand-icon">✳</span><span>polo<span className="brand-dot">.</span></span></Link>;
}
