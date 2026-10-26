import Link from "next/link";

import { Gutter } from "@/components/ui";
import { NEED_LABEL, topNeeds, type NeedScores } from "@/lib/know";
import { coordination } from "@/lib/ledger";
import { requireSession } from "@/lib/session";
import { SPHERES } from "@/lib/spheres";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Self · Sovereign" };

/**
 * Self, at a glance: four cards, one line each. Know yourself, what matters
 * to you, your record and your values each open their own full page, so the
 * tab is a single screen rather than a scroll. Same owner-only reads as the
 * full pages; nothing here is visible to anybody else.
 */
export default async function SelfPage() {
  const { userId } = await requireSession();
  const supabase = await createClient();
  const since = daysAgo(30);

  const [{ data: know }, { data: ratings }, { count: notes }, { count: todos }, { data: values }, entries] =
    await Promise.all([
      supabase
        .from("self_assessments")
        .select("focus, needs")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from("sphere_priorities").select("sphere_id, rating"),
      supabase.from("entries").select("id", { count: "exact", head: true }).eq("profile_id", userId).gte("created_at", since),
      supabase.from("todos").select("id", { count: "exact", head: true }).eq("profile_id", userId).is("done_at", null),
      supabase.from("profile_values").select("name").eq("profile_id", userId).order("position").limit(3),
      coordination().entries(200),
    ]);

  const drivers = know ? topNeeds(know.needs as NeedScores).map((n) => NEED_LABEL[n]) : [];
  const rated = (ratings ?? []) as { sphere_id: string; rating: number }[];
  const high = SPHERES.filter((s) => rated.some((r) => r.sphere_id === s.id && r.rating >= 4)).map((s) => s.name);
  const minted = entries.filter((e) => e.kind === "mint").reduce((a, e) => a + Number(e.amount), 0);
  const named = ((values ?? []) as { name: string }[]).map((v) => v.name);

  return (
    <Gutter className="space-y-3 pt-6">
      {know ? (
        <SelfCard href="/individual/self/findings" title="Know yourself" gold>
          {know.focus ? <span className="line-clamp-2 text-paper">{firstLine(know.focus as string)}</span> : null}
          <span className="block">Driven by {drivers.join(" · ")}</span>
        </SelfCard>
      ) : (
        <SelfCard href="/individual/self/know" title="Know yourself" gold>
          Ten minutes. Your AI starts from it.
        </SelfCard>
      )}

      <SelfCard href="/individual/self/matters" title="What matters">
        {high.length ? high.slice(0, 4).join(" · ") : rated.length ? `${rated.length} rated` : "Rate the Spheres"}
      </SelfCard>

      <SelfCard href="/individual/self/record" title="Your record">
        {notes ?? 0} notes · {todos ?? 0} to do · {minted} SOV
      </SelfCard>

      <SelfCard href="/individual/values" title="Values">
        {named.length ? named.join(" · ") : "Name three"}
      </SelfCard>
    </Gutter>
  );
}

function SelfCard({
  href,
  title,
  gold,
  children,
}: {
  href: string;
  title: string;
  gold?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`press flex items-center gap-3 rounded-card border px-4 py-3.5 active:bg-surface ${
        gold ? "border-gold/50 bg-gold/10" : "border-line bg-surface-soft"
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className="font-serif text-lg text-paper">{title}</p>
        <p className="mt-0.5 text-sm text-paper-dim">{children}</p>
      </div>
      <span aria-hidden className={gold ? "text-gold" : "text-paper-faint"}>
        →
      </span>
    </Link>
  );
}

/** An ISO time n days back, at request time. */
function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86400_000).toISOString();
}

/** The opening line of the AI's focus, for a one-glance card. */
function firstLine(s: string): string {
  return s.split(/\n+/)[0].trim();
}
