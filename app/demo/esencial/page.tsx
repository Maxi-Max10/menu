import { MenuView } from "@/components/MenuView";
import { demoProducts, demoRestaurant } from "@/lib/demo-menu";

export default function EssentialDemo() {
  return <MenuView restaurant={{ ...demoRestaurant, plan: "basic", orders_enabled: false }} products={demoProducts} demo />;
}
