import { notFound } from "next/navigation";
import { query } from "@/lib/db";
import { menuIsActive, type Product, type Restaurant } from "@/lib/types";
import { MenuView } from "@/components/MenuView";

export const dynamic = "force-dynamic";

export default async function PublicMenu({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const found = await query<Restaurant>("SELECT * FROM restaurants WHERE slug = $1", [slug]);
  const restaurant = found.rows[0];
  if (!restaurant) notFound();
  if (!menuIsActive(restaurant)) return <div className="unavailable"><div className="unavailable-icon">✳</div><h1>Esta carta no está disponible.</h1><p>Volvé a intentarlo más tarde o consultá con el local.</p></div>;
  const products = await query<Product>("SELECT * FROM products WHERE restaurant_id = $1 AND available = true ORDER BY category, created_at", [restaurant.id]);
  return <MenuView restaurant={restaurant} products={products.rows} />;
}
