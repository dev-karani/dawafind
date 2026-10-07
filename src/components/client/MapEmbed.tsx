"use client";

import { useState } from "react";
import { btn } from "../ui";

/** OpenStreetMap is only contacted after the user explicitly asks to see the map (no passive third-party tracking). */
export function MapEmbed({ lat, lng, name }: { lat: number; lng: number; name: string }) {
  const [show, setShow] = useState(false);
  const d = 0.006;
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${lng - d},${lat - d},${lng + d},${lat + d}&layer=mapnik&marker=${lat},${lng}`;
  if (!show) {
    return (
      <button type="button" onClick={() => setShow(true)} className={btn("secondary", "sm")}>
        Show map
      </button>
    );
  }
  return <iframe title={`Map showing ${name}`} src={src} className="h-64 w-full rounded-lg border border-slate-200" loading="lazy" referrerPolicy="no-referrer" />;
}
