import { SUPPORT_EMAIL, SUPPORT_PHONE, SUPPORT_PHONE_HREF } from "@/lib/support";

export function SupportLinks({ className = "" }: { className?: string }) {
  return <div className={`support-links ${className}`}>
    <a href={SUPPORT_PHONE_HREF}>{SUPPORT_PHONE}</a>
    <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
  </div>;
}
