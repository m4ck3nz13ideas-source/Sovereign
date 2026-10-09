"use client";

import { SPHERES, sphereOf, suggestSpheres, type SphereId } from "@/lib/spheres";

/**
 * Where a proposal sits: one main Sphere, an area within it, and up to two
 * more it also touches (0043). Most real proposals cross Spheres, so the
 * others are offered rather than hidden.
 *
 * The suggestion reads the draft's words and offers a guess. It never sets a
 * tag on its own.
 */
export function SpherePicker({
  sphere,
  area,
  also,
  text,
  onChange,
}: {
  sphere: string;
  area: string;
  also: string[];
  /** The draft so far, for the suggestion. */
  text: string;
  onChange: (next: { sphere: string; sphereArea: string; spheresAlso: string[] }) => void;
}) {
  const suggested = suggestSpheres(text).filter((s) => s !== sphere);
  const main = SPHERES.find((s) => s.id === sphere) ? sphereOf(sphere as SphereId) : null;

  function pickMain(id: string) {
    if (id === sphere) return onChange({ sphere: "", sphereArea: "", spheresAlso: [] });
    onChange({ sphere: id, sphereArea: "", spheresAlso: also.filter((s) => s !== id) });
  }
  function toggleAlso(id: string) {
    if (also.includes(id)) return onChange({ sphere, sphereArea: area, spheresAlso: also.filter((s) => s !== id) });
    if (also.length >= 2) return;
    onChange({ sphere, sphereArea: area, spheresAlso: [...also, id] });
  }

  return (
    <div>
      <span className="smallcaps mb-1.5 block text-[11px] text-paper-faint">Sphere</span>

      {suggested.length && !sphere ? (
        <p className="mb-2 text-xs text-paper-faint">
          Reads like{" "}
          {suggested.map((s, i) => (
            <span key={s}>
              {i ? ", " : ""}
              <button type="button" onClick={() => pickMain(s)} className="press text-gold underline-offset-2 hover:underline">
                {sphereOf(s).name}
              </button>
            </span>
          ))}
        </p>
      ) : null}

      <div className="grid grid-cols-4 gap-1.5" role="radiogroup" aria-label="Main Sphere">
        {SPHERES.map((s) => (
          <button
            key={s.id}
            type="button"
            role="radio"
            aria-checked={s.id === sphere}
            onClick={() => pickMain(s.id)}
            title={s.description}
            className={`press rounded-lg border px-1 py-2 text-center text-[0.75rem] ${
              s.id === sphere ? "border-gold bg-gold text-ink" : "border-line text-paper-dim"
            }`}
          >
            {s.name}
          </button>
        ))}
      </div>

      {main ? (
        <>
          <p className="mt-3 text-xs text-paper-faint">{main.description}</p>
          <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Area">
            {main.areas.map((a) => (
              <button
                key={a.id}
                type="button"
                aria-pressed={a.id === area}
                onClick={() => onChange({ sphere, sphereArea: a.id === area ? "" : a.id, spheresAlso: also })}
                className={`press rounded-full border px-3 py-1 text-xs ${
                  a.id === area ? "border-paper text-paper" : "border-line text-paper-faint"
                }`}
              >
                {a.name}
              </button>
            ))}
          </div>

          <span className="smallcaps mb-1.5 mt-4 block text-[11px] text-paper-faint">Also touches</span>
          <div className="flex flex-wrap gap-1.5">
            {SPHERES.filter((s) => s.id !== sphere).map((s) => {
              const on = also.includes(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={on}
                  disabled={!on && also.length >= 2}
                  onClick={() => toggleAlso(s.id)}
                  className={`press rounded-full border px-3 py-1 text-xs disabled:opacity-40 ${
                    on ? "border-paper text-paper" : "border-line text-paper-faint"
                  }`}
                >
                  {s.name}
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 text-xs text-paper-faint">Two at most. Fixed once anybody responds.</p>
        </>
      ) : null}
    </div>
  );
}
