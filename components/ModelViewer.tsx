"use client";

import { useEffect } from "react";

export function ModelViewer({ src, alt }: { src: string; alt: string }) {
  useEffect(() => { import("@google/model-viewer"); }, []);
  return <div className="viewer-shell"><model-viewer src={src} alt={alt} camera-controls auto-rotate ar ar-modes="webxr scene-viewer quick-look" ar-scale="fixed" xr-environment shadow-intensity="1" style={{ width: "100%", height: "100%" }} /></div>;
}
