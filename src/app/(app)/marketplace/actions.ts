"use server";

import { revalidatePath } from "next/cache";

import { AiError } from "@/lib/ai/provider";
import { vetVendor } from "@/lib/ai";
import { isOfferingKind, type OfferingKind } from "@/lib/marketplace";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true; id?: string } | { ok: false; error: string };

function done(id?: string): Result {
  revalidatePath("/marketplace", "layout");
  return { ok: true, id };
}

const https = (u: string) => /^https:\/\/\S+$/.test(u.trim());

/* ------------------------------------------------------------- businesses */

export async function registerVendor(input: {
  name: string;
  description: string;
  evidence: string;
  website: string;
  location: string;
}): Promise<Result> {
  if (input.name.trim().length < 2) return { ok: false, error: "Give your business its name." };
  if (input.description.trim().length < 40)
    return { ok: false, error: "Describe what you do in at least forty characters." };
  if (input.evidence.trim().length < 80)
    return {
      ok: false,
      error: "Give your evidence in at least eighty characters: how you treat people, what you use, where it comes from.",
    };
  if (!https(input.website)) return { ok: false, error: "Your website must start with https://" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("register_vendor", {
    p_name: input.name,
    p_description: input.description,
    p_evidence: input.evidence,
    p_website: input.website.trim(),
    p_location: input.location || null,
  });
  if (error) return { ok: false, error: error.message };
  return done(data as string);
}

export async function updateVendor(
  vendorId: string,
  input: { name: string; description: string; evidence: string; website: string; location: string },
): Promise<Result> {
  if (!https(input.website)) return { ok: false, error: "Your website must start with https://" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("vendors")
    .update({
      name: input.name.trim(),
      description: input.description.trim(),
      evidence: input.evidence.trim(),
      website: input.website.trim(),
      location: input.location.trim() || null,
    })
    .eq("id", vendorId);
  if (error) return { ok: false, error: error.message };
  return done();
}

/** Run the AI's reading on the words the business stands on right now. */
export async function requestVetting(vendorId: string): Promise<Result> {
  const supabase = await createClient();
  const { data: v, error: readErr } = await supabase
    .from("vendors")
    .select("name, description, evidence, website, location")
    .eq("id", vendorId)
    .maybeSingle();
  if (readErr || !v) return { ok: false, error: "Business not found." };

  try {
    const { readings, model, prompt } = await vetVendor(v);
    const { error } = await supabase.rpc("record_vendor_vetting", {
      p_vendor_id: vendorId,
      p_readings: readings,
      p_prompt_id: prompt.id,
      p_prompt_version: prompt.version,
      p_model: model,
    });
    if (error) return { ok: false, error: error.message };
    return done();
  } catch (e) {
    return {
      ok: false,
      error: e instanceof AiError ? e.message : "The vetting could not be run. Try again in a moment.",
    };
  }
}

/* -------------------------------------------------------------- listings */

export async function addOffering(input: {
  vendorId: string;
  kind: OfferingKind;
  name: string;
  description: string;
  price: string;
  url: string;
}): Promise<Result> {
  if (!isOfferingKind(input.kind)) return { ok: false, error: "Product or service?" };
  if (input.name.trim().length < 2) return { ok: false, error: "Give it a name." };
  if (input.description.trim().length < 20)
    return { ok: false, error: "Describe it in at least twenty characters." };
  if (!input.price.trim()) return { ok: false, error: "Give a price, even if it is \"from £10\"." };
  if (!https(input.url)) return { ok: false, error: "The link must start with https://" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("add_offering", {
    p_vendor_id: input.vendorId,
    p_kind: input.kind,
    p_name: input.name,
    p_description: input.description,
    p_price: input.price,
    p_url: input.url.trim(),
  });
  if (error) return { ok: false, error: error.message };
  return done(data as string);
}

export async function withdrawOffering(offeringId: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("withdraw_offering", { p_offering_id: offeringId });
  if (error) return { ok: false, error: error.message };
  return done();
}

/* ------------------------------------------------------------ advertising */

export async function createCampaign(input: {
  vendorId: string;
  offeringId: string | null;
  headline: string;
  body: string;
  bidPounds: number;
  budgetPounds: number;
}): Promise<Result> {
  const bid = Math.round(input.bidPounds * 100);
  const budget = Math.round(input.budgetPounds * 100);
  if (!(bid >= 5 && bid <= 10000)) return { ok: false, error: "A bid is between £0.05 and £100 a click." };
  if (!(budget >= 100)) return { ok: false, error: "A budget is at least £1." };
  if (budget < bid) return { ok: false, error: "The budget has to cover at least one click." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_campaign", {
    p_vendor_id: input.vendorId,
    p_offering_id: input.offeringId,
    p_headline: input.headline,
    p_body: input.body,
    p_bid_pence: bid,
    p_budget_pence: budget,
  });
  if (error) return { ok: false, error: error.message };
  return done(data as string);
}

export async function setCampaignPaused(campaignId: string, paused: boolean): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_campaign_paused", {
    p_campaign_id: campaignId,
    p_paused: paused,
  });
  if (error) return { ok: false, error: error.message };
  return done();
}

/* ---------------------------------------------------------------- buyers */

export async function raiseConcern(vendorId: string, lawId: string, reason: string): Promise<Result> {
  if (reason.trim().length < 20) return { ok: false, error: "Say what you saw in at least twenty characters." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("raise_vendor_concern", {
    p_vendor_id: vendorId,
    p_law_id: lawId,
    p_reason: reason,
  });
  if (error) return { ok: false, error: error.message };
  return done();
}

/* ------------------------------------------------------------- reviewers */

export async function signOff(vettingId: string, decision: "approved" | "refused", note: string): Promise<Result> {
  if (note.trim().length < 10) return { ok: false, error: "Leave a note of at least ten characters." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("sign_off_vetting", {
    p_vetting_id: vettingId,
    p_decision: decision,
    p_note: note,
  });
  if (error) return { ok: false, error: error.message };
  return done();
}

export async function suspendVendor(vendorId: string, reason: string): Promise<Result> {
  if (reason.trim().length < 20) return { ok: false, error: "Say why in at least twenty characters." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("suspend_vendor", { p_vendor_id: vendorId, p_reason: reason });
  if (error) return { ok: false, error: error.message };
  return done();
}

export async function liftSuspension(vendorId: string, note: string): Promise<Result> {
  if (note.trim().length < 10) return { ok: false, error: "Leave a note of at least ten characters." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("lift_suspension", { p_vendor_id: vendorId, p_note: note });
  if (error) return { ok: false, error: error.message };
  return done();
}

export async function closeConcern(concernId: string, note: string): Promise<Result> {
  if (note.trim().length < 10) return { ok: false, error: "Leave a note of at least ten characters." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("close_vendor_concern", { p_concern_id: concernId, p_note: note });
  if (error) return { ok: false, error: error.message };
  return done();
}

export async function removeOffering(offeringId: string, note: string): Promise<Result> {
  if (note.trim().length < 10) return { ok: false, error: "Leave a note of at least ten characters." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_offering", { p_offering_id: offeringId, p_note: note });
  if (error) return { ok: false, error: error.message };
  return done();
}
