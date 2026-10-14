"use client";

import type { CSSProperties } from "react";
import { Check } from "lucide-react";
import { isHexColor, menuColors, PALETTES, readableTextOn, type Palette, type Restaurant } from "@/lib/types";

export function PalettePicker({ restaurant, onChange }: {
  restaurant: Restaurant;
  onChange: (changes: Partial<Restaurant>) => void;
}) {
  const current = menuColors(restaurant);
  const primary = isHexColor(restaurant.custom_primary) ? restaurant.custom_primary : current.primary;
  const accent = isHexColor(restaurant.custom_accent) ? restaurant.custom_accent : current.accent;
  const custom = restaurant.palette === "personalizado";

  function selectCustom() {
    onChange({ palette: "personalizado", custom_primary: primary, custom_accent: accent });
  }

  return <div className="palette-section">
    <span className="field-title">COLORES DE TU CARTA</span>
    <div className="palette-options">
      {Object.entries(PALETTES).map(([key, value]) => <button type="button" key={key} title={value.label} aria-label={`Paleta ${value.label}`} aria-pressed={restaurant.palette === key} onClick={() => onChange({ palette: key as Palette })} className={restaurant.palette === key ? "chosen" : ""} style={{ background: value.primary }}><span style={{ background: value.accent }} />{restaurant.palette === key && <Check size={16} />}</button>)}
      <button type="button" title="Elegir dos colores" aria-label="Paleta personalizada" aria-pressed={custom} onClick={selectCustom} className={custom ? "chosen" : ""} style={{ background: `linear-gradient(135deg, ${primary} 50%, ${accent} 50%)` }}>{custom && <Check size={16} />}</button>
    </div>
    <small>{restaurant.palette === "personalizado" ? "Personalizada · elegí dos colores" : `${PALETTES[restaurant.palette].label} seleccionada`}</small>
    {custom && <div className="custom-palette">
      <p>Elegí un color principal y otro de acento. También podés escribir sus códigos hexadecimales.</p>
      <div className="custom-color-grid">
        <div className="custom-color-field">
          <span>Color principal</span>
          <div className="custom-color-controls">
            <input type="color" aria-label="Elegir color principal" value={primary} onChange={(event) => onChange({ custom_primary: event.target.value })} />
            <input type="text" aria-label="Hexadecimal principal" required pattern="#[0-9a-fA-F]{6}" maxLength={7} placeholder="#244638" spellCheck={false} value={restaurant.custom_primary ?? ""} onChange={(event) => onChange({ custom_primary: event.target.value.toUpperCase() })} />
          </div>
        </div>
        <div className="custom-color-field">
          <span>Color de acento</span>
          <div className="custom-color-controls">
            <input type="color" aria-label="Elegir color de acento" value={accent} onChange={(event) => onChange({ custom_accent: event.target.value })} />
            <input type="text" aria-label="Hexadecimal de acento" required pattern="#[0-9a-fA-F]{6}" maxLength={7} placeholder="#DFB66E" spellCheck={false} value={restaurant.custom_accent ?? ""} onChange={(event) => onChange({ custom_accent: event.target.value.toUpperCase() })} />
          </div>
        </div>
      </div>
      <div className="palette-preview" style={{ "--preview-primary": primary, "--preview-accent": accent, "--preview-text": readableTextOn(primary), "--preview-accent-text": readableTextOn(accent) } as CSSProperties}>
        <span>VISTA PREVIA DE TU CARTA</span>
        <strong>{restaurant.name}</strong>
        <em>Ver productos</em>
      </div>
    </div>}
  </div>;
}
