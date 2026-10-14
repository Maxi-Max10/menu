import { notFound } from "next/navigation";
import { RegisterForm } from "./RegisterForm";
import type { Plan } from "@/lib/types";

export default async function RegisterPage({ params }: { params: Promise<{ plan: string }> }) {
  const { plan } = await params;
  if (plan !== "esencial" && plan !== "premium") notFound();
  return <RegisterForm plan={(plan === "esencial" ? "basic" : "premium") as Plan} />;
}
