"use server";

import { revalidatePath } from "next/cache";

import { cleanHandle, fromLocalInput } from "@/lib/business";
import { createClient } from "@/lib/supabase/server";

/**
 * Running a business (0062, rule 55): the team, customers' messages, orders
 * and reviews. Every check that matters is in the database function each one
 * calls; these only shape the input and return the refusal in words.
 */

type Result = { ok: true; id?: string } | { ok: false; error: string };

function done(id?: string): Result {
  revalidatePath("/market", "layout");
  revalidatePath("/connection");
  return { ok: true, id };
}

const fail = (e: { message: string }): Result => ({ ok: false, error: e.message });

/* ------------------------------------------------------------------- team */

export async function inviteMember(vendorId: string, handle: string, role: "manager" | "staff"): Promise<Result> {
  const h = cleanHandle(handle);
  if (!h) return { ok: false, error: "Type their handle." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("invite_vendor_member", { p_vendor_id: vendorId, p_handle: h, p_role: role });
  return error ? fail(error) : done();
}

export async function acceptInvite(vendorId: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_vendor_invite", { p_vendor_id: vendorId });
  return error ? fail(error) : done();
}

/** Declining an invitation and leaving a team are the same act. */
export async function leaveVendor(vendorId: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("leave_vendor", { p_vendor_id: vendorId });
  return error ? fail(error) : done();
}

export async function removeMember(vendorId: string, profileId: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_vendor_member", { p_vendor_id: vendorId, p_profile_id: profileId });
  return error ? fail(error) : done();
}

export async function setMemberRole(vendorId: string, profileId: string, role: "manager" | "staff"): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_vendor_member_role", {
    p_vendor_id: vendorId,
    p_profile_id: profileId,
    p_role: role,
  });
  return error ? fail(error) : done();
}

/* -------------------------------------------------------------- messages */

export async function openConversation(vendorId: string): Promise<Result> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("open_vendor_conversation", { p_vendor_id: vendorId });
  return error ? fail(error) : done(data as string);
}

export async function sendVendorMessage(conversationId: string, body: string): Promise<Result> {
  const text = body.trim();
  if (!text) return { ok: false, error: "Write something first." };
  if (text.length > 4000) return { ok: false, error: "Keep it under 4,000 characters." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("send_vendor_message", { p_conversation_id: conversationId, p_body: text });
  if (error) return fail(error);
  revalidatePath(`/market/m/${conversationId}`);
  return done();
}

export async function markConversationRead(conversationId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc("mark_vendor_conversation_read", { p_conversation_id: conversationId });
}

/* ---------------------------------------------------------------- orders */

export async function placeOrder(input: {
  offeringId: string;
  quantity: number;
  request: string;
  wantedAt: string;
}): Promise<Result> {
  const quantity = Math.round(Number(input.quantity) || 1);
  if (quantity < 1 || quantity > 999) return { ok: false, error: "Ask for between 1 and 999." };
  if (input.request.trim().length > 1000) return { ok: false, error: "Keep the note under 1,000 characters." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("place_order", {
    p_offering_id: input.offeringId,
    p_quantity: quantity,
    p_request: input.request.trim() || null,
    p_wanted_at: fromLocalInput(input.wantedAt),
  });
  return error ? fail(error) : done(data as string);
}

async function move(fn: string, args: Record<string, unknown>, orderId: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc(fn, args);
  if (error) return fail(error);
  revalidatePath(`/market/orders/${orderId}`);
  return done();
}

export async function acceptOrder(orderId: string, agreedPrice: string, scheduledFor: string, note: string) {
  if (!agreedPrice.trim()) return { ok: false, error: "Say the price you are agreeing to." } as Result;
  return move(
    "accept_order",
    {
      p_order_id: orderId,
      p_agreed_price: agreedPrice.trim(),
      p_scheduled_for: fromLocalInput(scheduledFor),
      p_note: note.trim() || null,
    },
    orderId,
  );
}

export async function declineOrder(orderId: string, note: string) {
  return move("decline_order", { p_order_id: orderId, p_note: note.trim() }, orderId);
}

export async function cancelOrder(orderId: string, note: string) {
  return move("cancel_order", { p_order_id: orderId, p_note: note.trim() || null }, orderId);
}

export async function deliverOrder(orderId: string, note: string) {
  return move("deliver_order", { p_order_id: orderId, p_note: note.trim() || null }, orderId);
}

export async function confirmOrder(orderId: string, note: string) {
  return move("confirm_order", { p_order_id: orderId, p_note: note.trim() || null }, orderId);
}

export async function disputeOrder(orderId: string, note: string) {
  return move("dispute_order", { p_order_id: orderId, p_note: note.trim() }, orderId);
}

export async function completeUnanswered(orderId: string) {
  return move("complete_unanswered_order", { p_order_id: orderId }, orderId);
}

export async function resolveDispute(orderId: string, outcome: "completed" | "cancelled", note: string) {
  return move("resolve_order_dispute", { p_order_id: orderId, p_outcome: outcome, p_note: note.trim() }, orderId);
}

/* --------------------------------------------------------------- reviews */

export async function writeReview(orderId: string, rating: number, body: string): Promise<Result> {
  if (!(rating >= 1 && rating <= 5)) return { ok: false, error: "Choose one to five stars." };
  if (body.trim().length < 20) return { ok: false, error: "Say what it was like in at least twenty characters." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("write_review", {
    p_order_id: orderId,
    p_rating: Math.round(rating),
    p_body: body.trim(),
  });
  if (error) return fail(error);
  revalidatePath(`/market/orders/${orderId}`);
  return done();
}

export async function replyToReview(reviewId: string, reply: string): Promise<Result> {
  if (reply.trim().length < 10) return { ok: false, error: "Reply in at least ten characters." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("reply_to_review", { p_review_id: reviewId, p_reply: reply.trim() });
  return error ? fail(error) : done();
}

export async function removeReview(reviewId: string, note: string): Promise<Result> {
  if (note.trim().length < 10) return { ok: false, error: "Say why in at least ten characters." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_review", { p_review_id: reviewId, p_note: note.trim() });
  return error ? fail(error) : done();
}
