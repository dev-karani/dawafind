"use client";

import { useState } from "react";
import { AREAS } from "@/lib/areas";
import { btn, inputClass } from "../ui";

interface Props {
  q?: string;
  area?: string;
  lat?: number;
  lng?: number;
  compact?: boolean;
}

/** Plain GET form (works without JS). Precise location is optional and only used on request. */
export function SearchForm({ q = "", area = "", lat, lng, compact }: Props) {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(lat != null && lng != null ? { lat, lng } : null);
  const [geoError, setGeoError] = useState<string | null>(null);

  function locate() {
    setGeoError(null);
    if (!navigator.geolocation) return setGeoError("Your browser doesn't support location.");
    navigator.geolocation.getCurrentPosition(
      (p) => setCoords({ lat: Number(p.coords.latitude.toFixed(4)), lng: Number(p.coords.longitude.toFixed(4)) }),
      () => setGeoError("Couldn't get your location. You can choose an area instead."),
      { timeout: 8000, maximumAge: 300000 },
    );
  }

  return (
    <form action="/search" method="get" role="search" className="w-full">
      <div className={`flex flex-col gap-2 ${compact ? "md:flex-row" : "sm:flex-row"}`}>
        <div className="flex-1">
          <label htmlFor="q" className="sr-only">Search for a medicine</label>
          <input
            id="q"
            name="q"
            defaultValue={q}
            required
            maxLength={100}
            placeholder="Search for a medicine… e.g. Amoxicillin 500mg"
            className={`${inputClass} ${compact ? "" : "py-3.5 text-base"}`}
            autoComplete="off"
          />
        </div>
        <div className="sm:w-56">
          <label htmlFor="area" className="sr-only">Area</label>
          <select
            id="area"
            name="area"
            defaultValue={coords ? "" : area}
            disabled={!!coords}
            className={`${inputClass} ${compact ? "" : "py-3.5 text-base"}`}
          >
            <option value="">{coords ? "Using your location" : "Any area (no distance)"}</option>
            {AREAS.map((a) => (
              <option key={a.key} value={a.key}>{a.label}</option>
            ))}
          </select>
        </div>
        {coords && (
          <>
            <input type="hidden" name="lat" value={coords.lat} />
            <input type="hidden" name="lng" value={coords.lng} />
          </>
        )}
        <button type="submit" className={`${btn("primary")} ${compact ? "" : "px-6 py-3.5 text-base"}`}>Search</button>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        {coords ? (
          <>
            Using your approximate location for this search only.{" "}
            <button type="button" className="underline" onClick={() => setCoords(null)}>Choose an area instead</button>
          </>
        ) : (
          <>
            No location permission needed — pick a town or neighbourhood, or{" "}
            <button type="button" className="underline" onClick={locate}>use my current location</button>.
          </>
        )}
        {geoError && <span className="ml-1 text-red-700">{geoError}</span>}
      </p>
    </form>
  );
}
