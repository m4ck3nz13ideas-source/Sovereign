import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { SCOPES, placeAt, reachableScopes } from "@/lib/collective";
import { requireSession, type Session } from "@/lib/session";
import type { Group, GroupRole, GroupScope } from "@/lib/types";

const ADDRESS_COOKIE = "sovereign.address";

/**
 * The address the collective screens are currently looking at.
 *
 * Every screen under /connection is a view of one address — a group, or a
 * place at one of five scales. The selector at the top of those screens sets
 * it, and it persists, because moving between Proposals and Decisions should
 * not silently change which circle you are in.
 */
export type ViewAddress =
  | { kind: "group"; group: Group & { role: GroupRole }; label: string }
  | { kind: "place"; scope: GroupScope; place: string | null; label: string };

export interface AddressOption {
  /** The cookie value and the form value, e.g. "scope:local" or "group:<id>". */
  value: string;
  label: string;
  /** The place name at that scale, or the group's purpose. Shown underneath. */
  detail: string | null;
}

function scopeLabel(scope: GroupScope): string {
  return SCOPES.find((s) => s.value === scope)?.label ?? scope;
}

/** Every address this person can look at, scales first, then their groups. */
export function addressOptions(session: Session): AddressOption[] {
  const scopes = reachableScopes(session.profile).map((scope) => ({
    value: `scope:${scope}`,
    label: scopeLabel(scope),
    detail: placeAt(session.profile, scope),
  }));

  const groups = session.groups.map((g) => ({
    value: `group:${g.id}`,
    label: g.name,
    detail: "a group you were invited into",
  }));

  return [...scopes, ...groups];
}

function parse(value: string | undefined, session: Session): ViewAddress | null {
  if (!value) return null;

  if (value.startsWith("group:")) {
    const group = session.groups.find((g) => g.id === value.slice(6));
    return group ? { kind: "group", group, label: group.name } : null;
  }

  if (value.startsWith("scope:")) {
    const scope = value.slice(6) as GroupScope;
    if (!reachableScopes(session.profile).includes(scope)) return null;
    return {
      kind: "place",
      scope,
      place: placeAt(session.profile, scope),
      label: scopeLabel(scope),
    };
  }

  return null;
}

/**
 * The current address.
 *
 * Never null in practice: global is a scale everyone is in, so someone who has
 * said nothing and joined nothing still lands somewhere real rather than on a
 * dead end. The screens prompt for a place separately, where the prompt is
 * about what they are missing rather than about being locked out.
 */
export async function currentAddress(session: Session): Promise<ViewAddress | null> {
  const store = await cookies();
  const chosen = parse(store.get(ADDRESS_COOKIE)?.value, session);
  if (chosen) return chosen;

  const first = addressOptions(session)[0];
  return first ? parse(first.value, session) : null;
}

/** Like requireSession, but also insists there is somewhere to deliberate. */
export async function requireAddress(): Promise<Session & { address: ViewAddress }> {
  const session = await requireSession();
  const address = await currentAddress(session);
  if (!address) redirect("/settings/place");
  return { ...session, address };
}

export async function setAddress(value: string) {
  const store = await cookies();
  store.set(ADDRESS_COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}
