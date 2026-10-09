import { CtaBand, PageHero, Section } from "../_site/blocks";
import { ROADMAP } from "./items";

export const metadata = { title: "Roadmap" };

export default function RoadmapPage() {
  return (
    <>
      <PageHero
        eyebrow="Roadmap"
        title="What's built, what's next."
        lead="Ready for fifty people to really use by the end of 2026. Open to everyone in 2027. Nothing is listed as live until it is."
      />
      <Section>
        <div className="grid gap-6 lg:grid-cols-3">
          {ROADMAP.map((col) => (
            <div key={col.stage}>
              <div className="flex items-center gap-2.5">
                <span className={`h-2 w-2 rounded-full ${col.live ? "bg-calm" : "bg-paper-faint"}`} />
                <h2 className="font-serif text-2xl text-paper">{col.stage}</h2>
              </div>
              <p className="mt-1 text-paper-dim">{col.lead}</p>
              <ul className="mt-6 space-y-3">
                {col.items.map((it) => (
                  <li key={it.title} className="rounded-card border border-line bg-surface-soft p-5">
                    <p className="font-semibold text-paper">{it.title}</p>
                    <p className="mt-1.5 text-[0.95rem] leading-relaxed text-paper-dim">{it.detail}</p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>
      <Section className="bg-surface-soft">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-serif text-3xl text-paper">The test that matters.</h2>
          <p className="mt-4 text-lg leading-relaxed text-paper-dim">
            Not features shipped. Whether a real group made a real decision and found it calmer than usual. Whether
            a weak proposal was retired without a fight. Whether somebody came back to say how it went.
          </p>
        </div>
      </Section>
      <CtaBand title="Shape what gets built." lead="The founding 50 decide what comes next." />
    </>
  );
}
