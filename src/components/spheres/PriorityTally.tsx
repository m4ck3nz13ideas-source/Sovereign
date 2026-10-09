/**
 * What matters here: the average rating per Sphere among the people at this
 * address who rated. Never who. Nothing until enough people have rated, and
 * the screen says so rather than showing a number that is one person's.
 */
export type TallyRow = { sphere_id: string | null; name: string | null; average: number | null; raters: number; people: number };

export function PriorityTally({ rows, here, floor = 5 }: { rows: TallyRow[]; here: string; floor?: number }) {
  const people = rows[0]?.people ?? 0;
  const shown = rows.filter((r) => r.average !== null && r.sphere_id);

  if (!shown.length) {
    return (
      <p className="text-[0.9rem] leading-relaxed text-paper-dim">
        {people === 0
          ? `Nobody in ${here} has rated the Spheres yet.`
          : `${people} of the ${floor} people needed in ${here} have rated. The tally appears once ${floor} have, so no one's answer can be picked out.`}
      </p>
    );
  }

  return (
    <div>
      <ul className="space-y-2.5">
        {shown.map((r) => (
          <li key={r.sphere_id!} className="flex items-center gap-3">
            <span className="w-28 shrink-0 text-[0.9rem] text-paper">{r.name}</span>
            <span className="h-1.5 flex-1 rounded-full bg-surface">
              <span
                className="block h-1.5 rounded-full bg-gold"
                style={{ width: `${Math.round(((Number(r.average) - 1) / 4) * 100)}%` }}
              />
            </span>
            <span className="w-9 shrink-0 text-right text-xs tabular-nums text-paper-dim">{Number(r.average).toFixed(1)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-paper-faint">
        Average out of 5 · {people} {people === 1 ? "person" : "people"} in {here} · never who
      </p>
    </div>
  );
}
