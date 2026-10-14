import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import PanelClient from "./PanelClient";

export const dynamic = "force-dynamic";

export default async function PanelPage() {
  const session = await getSession();
  if (session?.role !== "restaurant" || !session.restaurantId) redirect("/ingresar");
  return <PanelClient />;
}
