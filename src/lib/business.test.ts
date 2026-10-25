import { describe, expect, it } from "vitest";

import {
  canReview,
  cleanHandle,
  orderActions,
  ORDER_REPLY_DAYS,
  REVIEW_WINDOW_DAYS,
  reviewBars,
  reviewMean,
  stars,
} from "./business";

const day = 86_400_000;
const now = Date.UTC(2026, 9, 25, 12);
const ago = (days: number) => new Date(now - days * day).toISOString();

describe("orderActions", () => {
  const team = { customer: false, team: true, reviewer: false };
  const customer = { customer: true, team: false, reviewer: false };
  const reviewer = { customer: false, team: false, reviewer: true };

  it("lets the team answer a request and the customer withdraw it", () => {
    expect(orderActions({ status: "requested", delivered_at: null }, team, now)).toEqual(["accept", "decline"]);
    expect(orderActions({ status: "requested", delivered_at: null }, customer, now)).toEqual(["cancel"]);
  });

  it("leaves completion to the customer", () => {
    const delivered = { status: "delivered" as const, delivered_at: ago(1) };
    expect(orderActions(delivered, team, now)).toEqual([]);
    expect(orderActions(delivered, customer, now)).toEqual(["confirm", "dispute"]);
  });

  it(`lets the team close an order after ${ORDER_REPLY_DAYS} days of silence`, () => {
    const old = { status: "delivered" as const, delivered_at: ago(ORDER_REPLY_DAYS) };
    expect(orderActions(old, team, now)).toEqual(["complete_unanswered"]);
  });

  it("gives a dispute to a reviewer who is not part of it", () => {
    const disputed = { status: "disputed" as const, delivered_at: ago(2) };
    expect(orderActions(disputed, reviewer, now)).toEqual(["resolve"]);
    expect(orderActions(disputed, { ...reviewer, team: true }, now)).toEqual([]);
    expect(orderActions(disputed, { ...reviewer, customer: true }, now)).toEqual([]);
  });

  it("offers nothing on a closed order", () => {
    for (const status of ["completed", "cancelled", "declined"] as const) {
      expect(orderActions({ status, delivered_at: null }, { customer: true, team: true, reviewer: true }, now)).toEqual([]);
    }
  });
});

describe("reviews", () => {
  it("are written once, after completion, inside the window", () => {
    expect(canReview({ status: "completed", completed_at: ago(1) }, false, now)).toBe(true);
    expect(canReview({ status: "completed", completed_at: ago(1) }, true, now)).toBe(false);
    expect(canReview({ status: "delivered", completed_at: null }, false, now)).toBe(false);
    expect(canReview({ status: "completed", completed_at: ago(REVIEW_WINDOW_DAYS + 1) }, false, now)).toBe(false);
  });

  it("show no mean below the floor, and the bars always", () => {
    const few = { reviews: 2, one: 0, two: 0, three: 0, four: 1, five: 1 };
    expect(reviewMean(few)).toBeNull();
    expect(reviewBars(few).map((b) => b.count)).toEqual([1, 1, 0, 0, 0]);
    const many = { reviews: 6, one: 1, two: 0, three: 0, four: 0, five: 5 };
    expect(reviewMean(many)).toBe("4.3");
    expect(reviewBars(many)[0].share).toBeCloseTo(5 / 6);
  });

  it("draw stars within one to five", () => {
    expect(stars(4)).toBe("★★★★☆");
    expect(stars(9)).toBe("★★★★★");
  });
});

it("cleans a handle the way the database matches it", () => {
  expect(cleanHandle(" @OpsBen ")).toBe("opsben");
});
