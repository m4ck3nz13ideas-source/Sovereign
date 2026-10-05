import Link from "next/link";

import { Empty, Gutter, inputClass, PillLink, Rail, Screen, Tag, TopBar } from "@/components/ui";
import { firstLine } from "@/lib/format";
import { isOfferingKind, safeUrl, type Ad, type MarketOffering } from "@/lib/marketplace";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Marketplace · Sovereign" };

/**
 * Marketplace — trade with businesses that align with the Universal Laws.
 *
 * Every business here was read against all ten laws by the AI and signed off
 * by a reviewer, for the words it stands on now. Buying happens on the
 * business's own site; a listing links out.
 *
 * One slot is sponsored, and says so. Of the approved businesses running a
 * campaign, it goes to the one that best fits the person looking — their own
 * values first, then how cleanly the business passed its vetting — and the
 * bid only breaks ties (0033). Paying makes a business eligible for the slot
 * and sets what a click costs; it does not decide who gets it. The list below
 * is newest first and is not for sale.
 */
export default async function MarketplacePage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; view?: string; q?: string }>;
}) {
  await requireSession();
  const { kind: rawKind, view, q: rawQ } = await searchParams;
  const kind = isOfferingKind(rawKind) ? rawKind : null;
  const businesses = view === "businesses";
  const q = (rawQ ?? "").trim().slice(0, 80);

  const supabase = await createClient();
  const [{ data: adRaw }, listing, { data: reviewer }] = await Promise.all([
    supabase.rpc("pick_ad"),
    businesses
      ? supabase.rpc("market_vendors", { p_q: q || null })
      : supabase.rpc("market_offerings", { p_kind: kind, p_q: q || null }),
    supabase.rpc("is_marketplace_reviewer"),
  ]);

  const ad = ((adRaw ?? []) as Ad[])[0] ?? null;
  const offerings = businesses ? [] : ((listing.data ?? []) as MarketOffering[]);
  const vendors = businesses
    ? ((listing.data ?? []) as { id: string; name: string; description: string; location: string | null }[])
    : [];
  const broken = !!listing.error;

  const tab = (label: string, href: string, active: boolean) => (
    <PillLink href={href} active={active}>
      {label}
    </PillLink>
  );
  const qs = q ? `&q=${encodeURIComponent(q)}` : "";

  return (
    <Screen>
      <TopBar title="Marketplace">
        <Rail>
          {tab("All", `/marketplace?${qs.slice(1)}`, !kind && !businesses)}
          {tab("Products", `/marketplace?kind=product${qs}`, kind === "product")}
          {tab("Services", `/marketplace?kind=service${qs}`, kind === "service")}
          {tab("Businesses", `/marketplace?view=businesses${qs}`, businesses)}
        </Rail>
      </TopBar>

      <Gutter>
        <form action="/marketplace" className="mt-4">
          {kind ? <input type="hidden" name="kind" value={kind} /> : null}
          {businesses ? <input type="hidden" name="view" value="businesses" /> : null}
          <input
            name="q"
            defaultValue={q}
            placeholder="Search the marketplace"
            className={inputClass}
            aria-label="Search the marketplace"
          />
        </form>

        {broken ? (
          <p className="mt-4 text-sm text-alarm">
            The marketplace could not be read. If this is a new install, migration 0030 has not been
            applied yet.
          </p>
        ) : null}

        {ad ? (
          <a
            href={`/marketplace/ad/${ad.campaign_id}`}
            rel="sponsored noopener"
            className="press mt-5 block rounded-card border border-gold/40 bg-surface-soft px-4 py-3.5 active:bg-surface"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="smallcaps text-[10px] text-gold">Sponsored</span>
              <span className="text-xs text-paper-faint">{ad.vendor_name}</span>
            </div>
            <p className="mt-1.5 font-serif text-lg leading-snug text-paper">{ad.headline}</p>
            <p className="mt-1 text-sm leading-relaxed text-paper-dim">{ad.body}</p>
            {ad.matched?.length ? (
              <p className="mt-2 text-xs text-paper-faint">
                Fits: {ad.matched.join(", ")}
              </p>
            ) : null}
          </a>
        ) : null}
      </Gutter>

      <Gutter className="mt-6">
        {businesses ? (
          vendors.length ? (
            <ul className="space-y-3">
              {vendors.map((v) => (
                <li key={v.id}>
                  <Link
                    href={`/marketplace/v/${v.id}`}
                    className="press block rounded-card border border-line bg-surface-soft px-4 py-3.5 active:bg-surface"
                  >
                    <span className="font-serif text-lg leading-snug text-paper">{v.name}</span>
                    <p className="mt-1.5 text-sm leading-relaxed text-paper-dim">{firstLine(v.description, 140)}</p>
                    {v.location ? <p className="mt-2 text-xs text-paper-faint">{v.location}</p> : null}
                  </Link>
                </li>
              ))}
            </ul>
          ) : !broken ? (
            <Empty>{q ? `No businesses match “${q}”.` : "No businesses have been approved yet."}</Empty>
          ) : null
        ) : offerings.length ? (
          <ul className="space-y-3">
            {offerings.map((o) => {
              const href = safeUrl(o.url);
              return (
                <li key={o.id} className="rounded-card border border-line bg-surface-soft px-4 py-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <span className="font-serif text-lg leading-snug text-paper">{o.name}</span>
                    <Tag>{o.kind}</Tag>
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-paper-dim">{firstLine(o.description, 160)}</p>
                  <div className="mt-3 flex items-center justify-between gap-3 text-sm">
                    <Link href={`/marketplace/v/${o.vendor_id}`} className="text-paper-faint hover:text-paper">
                      {o.vendor_name}
                    </Link>
                    <span className="text-paper">{o.price}</span>
                  </div>
                  {href ? (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-block text-sm text-gold hover:underline"
                    >
                      Buy from {o.vendor_name} ↗
                    </a>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : !broken ? (
          <Empty>{q ? `Nothing matches “${q}”.` : "Nothing has been listed yet."}</Empty>
        ) : null}
      </Gutter>

      <Gutter className="mt-10 pb-4">
        <div className="flex flex-wrap gap-4 text-sm">
          <Link href="/marketplace/sell" className="text-gold hover:underline">
            Sell here
          </Link>
          {reviewer ? (
            <Link href="/marketplace/review" className="text-gold hover:underline">
              Review queue
            </Link>
          ) : null}
        </div>
      </Gutter>
    </Screen>
  );
}
