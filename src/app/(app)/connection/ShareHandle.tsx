"use client";

import Link from "next/link";
import { useState } from "react";

/**
 * Your handle, to give to someone. People can only be found by exact handle
 * (there is no directory, on purpose), so this is how anybody finds you: copy
 * it, share a link, or let them scan the code from your screen. The link opens
 * People with your handle already filled in.
 */
export function ShareHandle({ handle, link, qr }: { handle: string | null; link: string | null; qr: string | null }) {
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);

  if (!handle || !link) {
    return (
      <div className="rounded-card border border-line bg-surface-soft px-4 py-4 text-center">
        <p className="text-[0.95rem] text-paper">Choose a handle so people can find you</p>
        <p className="mt-1 text-[0.8125rem] text-paper-faint">Nobody can be found without one. There is no directory.</p>
        <Link href="/individual/profile" className="smallcaps mt-3 inline-block text-[11px] text-gold">
          Set your handle →
        </Link>
      </div>
    );
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(link!);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard refused: the handle is on screen to read out */
    }
  }

  async function share() {
    try {
      if (navigator.share) await navigator.share({ title: "Find me on Sovereign", text: `I'm @${handle} on Sovereign`, url: link! });
      else await copy();
    } catch {
      /* dismissed */
    }
  }

  return (
    <div className="rounded-card border border-line bg-surface-soft px-4 py-4 text-center">
      <p className="smallcaps text-[10px] text-paper-faint">Your handle</p>
      <p className="display mt-1 text-[1.5rem] text-paper">@{handle}</p>
      <p className="mt-1 text-[0.8125rem] text-paper-faint">The only way anyone can find you. Give it to the people you want here.</p>
      <div className="mt-3 flex justify-center gap-2">
        <button type="button" onClick={copy} className="press rounded-pill bg-surface px-3.5 py-1.5 text-[0.8125rem] text-paper-dim">
          {copied ? "Copied" : "Copy link"}
        </button>
        <button type="button" onClick={share} className="press rounded-pill bg-surface px-3.5 py-1.5 text-[0.8125rem] text-paper-dim">
          Share
        </button>
        {qr ? (
          <button
            type="button"
            onClick={() => setShowQr((v) => !v)}
            aria-expanded={showQr}
            className="press rounded-pill bg-surface px-3.5 py-1.5 text-[0.8125rem] text-paper-dim"
          >
            {showQr ? "Hide code" : "QR code"}
          </button>
        ) : null}
      </div>
      {showQr && qr ? (
        <div
          className="mx-auto mt-4 w-48 rounded-card bg-white p-3"
          // Generated on the server from your own link; no user HTML goes in.
          dangerouslySetInnerHTML={{ __html: qr }}
        />
      ) : null}
    </div>
  );
}
