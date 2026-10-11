import { env } from "@/lib/env";

import { CONTACT_EMAIL } from "./site";

/**
 * Structured data for search engines: who runs the site and what it is.
 * No ratings, no reviews, no offers — nothing schema.org would let us
 * claim that is not true today.
 */
export function JsonLd() {
  const url = env.canonicalUrl;
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${url}/#org`,
        name: "Sovereign",
        url: `${url}/explore`,
        email: CONTACT_EMAIL,
        logo: `${url}/icon.svg`,
      },
      {
        "@type": "WebSite",
        "@id": `${url}/#site`,
        name: "Sovereign",
        url: `${url}/explore`,
        publisher: { "@id": `${url}/#org` },
        inLanguage: "en-GB",
      },
      {
        "@type": "WebApplication",
        name: "Sovereign",
        url: `${url}/explore`,
        applicationCategory: "SocialNetworkingApplication",
        operatingSystem: "Web",
        isAccessibleForFree: true,
        description: "Vote on ideas, not politicians. A private space, an honest feed, a vetted market and a fair way to decide.",
      },
    ],
  };
  return (
    <script
      type="application/ld+json"
      // JSON.stringify output with "<" escaped, so a value can never close the tag.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
