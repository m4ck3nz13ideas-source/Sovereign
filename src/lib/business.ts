/**
 * Running a business on Sovereign (0062, rule 55): its team, its customers'
 * messages, orders and bookings, and reviews. Pure helpers for the screens;
 * every rule here is enforced again, and decided, in Postgres.
 */

export type TeamRole = "owner" | "manager" | "staff";
export type OrderStatus =
  | "requested"
  | "accepted"
  | "declined"
  | "cancelled"
  | "delivered"
  | "completed"
  | "disputed";

/** Mirrors `order_reply_days()`: how long a customer has to confirm or report a problem. */
export const ORDER_REPLY_DAYS = 14;
/** Mirrors `review_window_days()`. */
export const REVIEW_WINDOW_DAYS = 90;
/** Below this many reviews the screen shows the counts and no mean. */
export const REVIEW_MEAN_FLOOR = 5;

export interface Order {
  id: string;
  vendor_id: string;
  offering_id: string | null;
  customer_id: string;
  kind: "product" | "service";
  item_name: string;
  listed_price: string;
  quantity: number;
  request: string | null;
  wanted_at: string | null;
  status: OrderStatus;
  agreed_price: string | null;
  scheduled_for: string | null;
  created_at: string;
  updated_at: string;
  accepted_at: string | null;
  delivered_at: string | null;
  disputed_at: string | null;
  completed_at: string | null;
  closed_at: string | null;
}

export interface OrderEvent {
  id: string;
  order_id: string;
  actor_id: string;
  from_status: OrderStatus | null;
  to_status: OrderStatus;
  note: string | null;
  created_at: string;
}

export interface Desk {
  vendor_id: string;
  vendor_name: string;
  role: TeamRole;
  to_answer: number;
  in_progress: number;
  problems: number;
  unread: number;
  last_at: string | null;
}

export interface TeamMember {
  profile_id: string;
  display_name: string;
  handle: string | null;
  role: TeamRole;
  accepted: boolean;
}

export interface Review {
  id: string;
  rating: number;
  body: string;
  author_name: string;
  item_name: string;
  created_at: string;
  reply: string | null;
  replied_at: string | null;
}

export interface ReviewSummary {
  reviews: number;
  one: number;
  two: number;
  three: number;
  four: number;
  five: number;
}

export const ORDER_STATUS: Record<OrderStatus, { label: string; tone: "neutral" | "gold" | "alarm" | "calm" }> = {
  requested: { label: "waiting for the business", tone: "gold" },
  accepted: { label: "accepted", tone: "neutral" },
  declined: { label: "declined", tone: "neutral" },
  cancelled: { label: "cancelled", tone: "neutral" },
  delivered: { label: "done · waiting for the customer", tone: "gold" },
  completed: { label: "completed", tone: "calm" },
  disputed: { label: "problem reported", tone: "alarm" },
};

/** What an order is called, by what it is. */
export function orderNoun(kind: Order["kind"]): string {
  return kind === "service" ? "booking" : "order";
}

export type OrderAction =
  | "accept"
  | "decline"
  | "deliver"
  | "cancel"
  | "confirm"
  | "dispute"
  | "complete_unanswered"
  | "resolve";

/**
 * Which moves the screen offers. The database decides; this only avoids
 * offering a button that would be refused.
 */
export function orderActions(
  order: Pick<Order, "status" | "delivered_at">,
  as: { customer: boolean; team: boolean; reviewer: boolean },
  now: number = Date.now(),
): OrderAction[] {
  const out: OrderAction[] = [];
  const { status } = order;
  if (as.team) {
    if (status === "requested") out.push("accept", "decline");
    if (status === "accepted") out.push("deliver", "cancel");
    if (status === "delivered" && order.delivered_at && replyWindowOver(order.delivered_at, now))
      out.push("complete_unanswered");
  }
  if (as.customer) {
    if (status === "requested" || status === "accepted") out.push("cancel");
    if (status === "delivered") out.push("confirm", "dispute");
  }
  if (as.reviewer && !as.team && !as.customer && status === "disputed") out.push("resolve");
  return [...new Set(out)];
}

export function replyWindowOver(deliveredAt: string, now: number = Date.now()): boolean {
  return now - new Date(deliveredAt).getTime() >= ORDER_REPLY_DAYS * 86_400_000;
}

export function canReview(
  order: Pick<Order, "status" | "completed_at">,
  reviewed: boolean,
  now: number = Date.now(),
): boolean {
  if (order.status !== "completed" || reviewed || !order.completed_at) return false;
  return now - new Date(order.completed_at).getTime() <= REVIEW_WINDOW_DAYS * 86_400_000;
}

/** The counts, highest star first, each with its share of the whole. */
export function reviewBars(s: ReviewSummary): { stars: number; count: number; share: number }[] {
  const counts = [s.five, s.four, s.three, s.two, s.one];
  return counts.map((count, i) => ({
    stars: 5 - i,
    count,
    share: s.reviews ? count / s.reviews : 0,
  }));
}

/**
 * The mean, to one place, only from REVIEW_MEAN_FLOOR reviews up, and only
 * ever drawn beside the bars it came from.
 */
export function reviewMean(s: ReviewSummary): string | null {
  if (s.reviews < REVIEW_MEAN_FLOOR) return null;
  const total = 5 * s.five + 4 * s.four + 3 * s.three + 2 * s.two + s.one;
  return (total / s.reviews).toFixed(1);
}

export function stars(n: number): string {
  const k = Math.max(0, Math.min(5, Math.round(n)));
  return "★".repeat(k) + "☆".repeat(5 - k);
}

export const ROLE_COPY: Record<TeamRole, string> = {
  owner: "Owner · everything, including what the business claims, its ads and its team",
  manager: "Manager · listings, updates, orders, messages and replies to reviews",
  staff: "Staff · orders and messages",
};

/** "@handle" from whatever was typed. */
export function cleanHandle(h: string): string {
  return h.trim().replace(/^@/, "").toLowerCase().slice(0, 40);
}

/** A local date-time input value (yyyy-mm-ddThh:mm) to an ISO string, or null. */
export function fromLocalInput(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function whenText(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/London",
  });
}
