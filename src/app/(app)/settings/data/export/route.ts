import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * A copy of everything that names you (rule 42): `my_data_export()` as a JSON
 * download. The function reads only rows naming the caller, so there is no
 * argument to get wrong here.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const { data, error } = await supabase.rpc("my_data_export");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const day = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="sovereign-my-data-${day}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
