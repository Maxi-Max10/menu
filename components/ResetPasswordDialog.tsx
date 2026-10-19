"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Check, X } from "lucide-react";
import { api } from "@/lib/client";
import { passwordSchema } from "@/lib/validation";
import type { Restaurant } from "@/lib/types";
import styles from "./ResetPasswordDialog.module.css";

export function ResetPasswordDialog({ restaurant, onClose, onSaved }: {
  restaurant: Pick<Restaurant, "id" | "name" | "owner_email">;
  onClose: () => void;
  onSaved: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const passwordInput = useRef<HTMLInputElement>(null);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const element = dialog.current!;
    element.showModal();
    passwordInput.current?.focus();
    return () => element.close();
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const parsed = passwordSchema.safeParse(password);
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    if (password !== confirmation) { setError("Las contraseñas no coinciden"); return; }
    setBusy(true);
    setError("");
    try {
      await api(`/api/admin/restaurants/${restaurant.id}/password`, { method: "POST", body: JSON.stringify({ password: parsed.data }) });
      setPassword("");
      setConfirmation("");
      onSaved();
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "No se pudo restablecer la contraseña");
      setBusy(false);
    }
  }

  return <dialog ref={dialog} className={`form-modal ${styles.dialog}`} aria-labelledby="reset-password-title" onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}>
    <div className="modal-head">
      <div><span className="overline">ACCESO DEL LOCAL</span><h2 id="reset-password-title">Restablecer contraseña</h2></div>
      <button type="button" className="icon-button" disabled={busy} onClick={onClose} aria-label="Cerrar"><X size={20} /></button>
    </div>
    <p>Nueva contraseña para <strong>{restaurant.name}</strong>{restaurant.owner_email && <> · {restaurant.owner_email}</>}. Las sesiones abiertas de esta cuenta se cerrarán.</p>
    <form onSubmit={submit}>
      <label>Nueva contraseña<input ref={passwordInput} required type={visible ? "text" : "password"} autoComplete="new-password" minLength={10} maxLength={72} disabled={busy} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Mínimo 10 caracteres" /></label>
      <label>Repetir nueva contraseña<input required type={visible ? "text" : "password"} autoComplete="new-password" minLength={10} maxLength={72} disabled={busy} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label>
      <label className="checkbox-label"><input type="checkbox" checked={visible} onChange={(event) => setVisible(event.target.checked)} /> Mostrar contraseña</label>
      {error && <div className="form-error" role="alert">{error}</div>}
      <div className="modal-actions">
        <button type="button" className="button button-outline" disabled={busy} onClick={onClose}>Cancelar</button>
        <button className="button button-dark" disabled={busy}>{busy ? "Guardando…" : "Guardar contraseña"}<Check size={17} /></button>
      </div>
    </form>
  </dialog>;
}
