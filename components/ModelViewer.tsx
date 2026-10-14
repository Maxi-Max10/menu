"use client";

import { useEffect, useRef } from "react";

export function ModelViewer({ src, alt }: { src: string; alt: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { import("@google/model-viewer"); }, []);
  return <div ref={ref} className="viewer-shell"><model-viewer src={src} alt={alt} camera-controls auto-rotate ar ar-modes="webxr scene-viewer quick-look" shadow-intensity="1" style={{ width: "100%", height: "100%" }} /></div>;
}
