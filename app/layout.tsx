import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mesa — Cartas digitales para cada mesa",
  description: "Creá una carta digital con tu identidad. Administrá productos, planes y pagos desde un solo lugar.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>;
}
