import Link from "next/link";

import { Mark } from "./SiteHeader";
import { CONTACT_EMAIL, FOOTER } from "./site";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-line">
      <div className="mx-auto grid max-w-6xl gap-12 px-5 py-14 lg:grid-cols-[1.4fr_3fr]">
        <div>
          <Link href="/explore" className="flex items-center gap-2.5">
            <Mark />
            <span className="font-serif text-xl text-paper">Sovereign</span>
          </Link>
          <p className="mt-4 max-w-xs text-paper-dim">Better decisions. Together.</p>
          <p className="mt-6 text-sm text-paper-faint">
            <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-paper">
              {CONTACT_EMAIL}
            </a>
          </p>
        </div>

        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          {FOOTER.map((col) => (
            <div key={col.title}>
              <p className="smallcaps text-[11px] text-paper-faint">{col.title}</p>
              <ul className="mt-4 space-y-3">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="text-[0.95rem] text-paper-dim hover:text-paper">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-line-soft">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-6 text-sm text-paper-faint sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Sovereign. For people, not profit.</p>
          <p>No trackers. No ad networks. Fonts served from here.</p>
        </div>
      </div>
    </footer>
  );
}
