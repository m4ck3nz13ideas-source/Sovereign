import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

/**
 * Link previews: the card a chat app or a social site draws when somebody
 * pastes a Sovereign link.
 *
 * One frame for every page so the brand reads the same everywhere: black
 * ground, white serif, amber for the one thing worth acting on. Fonts are
 * read from assets/og (static .woff — the image renderer cannot read the
 * variable .woff2 the app uses). SIL Open Font Licence, see assets/og/README.
 */

export const OG_SIZE = { width: 1200, height: 630 };

const C = {
  ink: "#000000",
  paper: "#ffffff",
  dim: "#a8a8a8",
  faint: "#737373",
  line: "#262626",
  gold: "#ff9500",
  calm: "#32d74b",
  alarm: "#ff453a",
};

async function fonts() {
  const dir = join(process.cwd(), "assets/og");
  const [serif, sans, sansBold] = await Promise.all([
    readFile(join(dir, "playfair-display-latin-600-normal.woff")),
    readFile(join(dir, "inter-latin-400-normal.woff")),
    readFile(join(dir, "inter-latin-600-normal.woff")),
  ]);
  return [
    { name: "Playfair", data: serif, weight: 600 as const, style: "normal" as const },
    { name: "Inter", data: sans, weight: 400 as const, style: "normal" as const },
    { name: "Inter", data: sansBold, weight: 600 as const, style: "normal" as const },
  ];
}

function clip(s: string, n: number) {
  return s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s;
}

function Frame({ eyebrow, children }: { eyebrow: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: C.ink,
        color: C.paper,
        padding: "64px 72px",
        fontFamily: "Inter",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ width: 14, height: 14, borderRadius: 999, background: C.gold }} />
        <div style={{ fontFamily: "Playfair", fontSize: 34 }}>Sovereign</div>
        <div style={{ marginLeft: 16, fontSize: 22, letterSpacing: 3, color: C.faint, textTransform: "uppercase" }}>
          {eyebrow}
        </div>
      </div>
      {children}
    </div>
  );
}

/** A plain page: a headline and a line under it. */
export async function pageCard({ eyebrow, title, line }: { eyebrow: string; title: string; line: string }) {
  return new ImageResponse(
    (
      <Frame eyebrow={eyebrow}>
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <div style={{ fontFamily: "Playfair", fontSize: 76, lineHeight: 1.08, maxWidth: 1000 }}>{clip(title, 70)}</div>
          <div style={{ fontSize: 32, lineHeight: 1.35, color: C.dim, maxWidth: 960 }}>{clip(line, 140)}</div>
        </div>
        <div style={{ display: "flex", gap: 36, fontSize: 24, color: C.faint }}>
          <span>No trackers</span>
          <span>No ranking</span>
          <span>No data sold</span>
        </div>
      </Frame>
    ),
    { ...OG_SIZE, fonts: await fonts() },
  );
}

/** A shared decision: what was asked, what was decided, on how many voices. */
export async function decisionCard(d: {
  title: string;
  outcome: string;
  voices: number;
  alignment: number | null;
  split: boolean | null;
  decidedOn: string;
}) {
  const passed = d.outcome === "passed";
  return new ImageResponse(
    (
      <Frame eyebrow="A decision">
        <div style={{ display: "flex", flexDirection: "column", gap: 30 }}>
          <div style={{ fontFamily: "Playfair", fontSize: 68, lineHeight: 1.1, maxWidth: 1050 }}>{clip(d.title, 80)}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <div
              style={{
                display: "flex",
                fontSize: 30,
                fontWeight: 600,
                padding: "10px 26px",
                borderRadius: 999,
                color: passed ? C.calm : C.alarm,
                border: `2px solid ${passed ? C.calm : C.alarm}`,
              }}
            >
              {passed ? "Passed" : "Did not pass"}
            </div>
            {d.split ? <div style={{ fontSize: 28, color: C.alarm }}>A split decision</div> : null}
          </div>
        </div>
        <div style={{ display: "flex", gap: 64, borderTop: `1px solid ${C.line}`, paddingTop: 28 }}>
          <Stat label="Voices" value={String(d.voices)} />
          {d.alignment !== null ? <Stat label="Alignment" value={d.alignment.toFixed(2)} /> : null}
          <Stat label="Decided" value={d.decidedOn} quiet />
        </div>
      </Frame>
    ),
    { ...OG_SIZE, fonts: await fonts() },
  );
}

function Stat({ label, value, quiet = false }: { label: string; value: string; quiet?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ fontSize: 20, letterSpacing: 3, color: C.faint, textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: 40, fontWeight: 600, color: quiet ? C.paper : C.gold }}>{value}</div>
    </div>
  );
}
