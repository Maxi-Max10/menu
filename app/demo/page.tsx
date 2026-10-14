import { MenuView } from "@/components/MenuView";
import { demoProducts, demoRestaurant } from "@/lib/demo-menu";

export default function Demo() {
  return <MenuView restaurant={demoRestaurant} products={demoProducts} demo />;
}
