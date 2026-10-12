import { createClient } from "@supabase/supabase-js";
import { verify } from "https://deno.land/x/paddle_webhook_verify/mod.ts";

Deno.serve(async (req) => {
  const rawBody = await req.text();
  const signature = req.headers.get("paddle-signature");

  if (!signature) {
    return new Response("Missing Paddle signature", { status: 400 });
  }

  const isValid = await verify({
    webhookSecret: Deno.env.get("PADDLE_WEBHOOK_SECRET")!,
    rawBody,
    signature,
  });

  if (!isValid) {
    return new Response("Invalid Paddle signature", { status: 400 });
  }

  const event = JSON.parse(rawBody);

  if (
    event.event_type !== "transaction.completed"
  ) {
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
    });
  }

  const customData = event.data?.custom_data;
  const userId = customData?.user_id;
  const paymentType = customData?.payment_type;
  const itemId = customData?.item_id;

  if (!userId) {
    return new Response("Missing user reference", { status: 400 });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const amountCents = Math.round(
    Number(event.data?.details?.totals?.total || 0)
  );

  const { data: payment } = await supabaseAdmin
    .from("payments")
    .insert({
      user_id: userId,
      payment_type: paymentType,
      item_id: itemId || null,
      amount_cents: amountCents,
      currency: event.data?.currency_code?.toLowerCase() || "usd",
      status: "paid",
      metadata: event.data,
    })
    .select()
    .single();

  if (paymentType === "product" && itemId) {
    await supabaseAdmin.from("product_purchases").upsert({
      user_id: userId,
      product_id: itemId,
      payment_id: payment?.id,
    });
  }

  if (paymentType === "film_buy" && itemId) {
    await supabaseAdmin.from("film_access").upsert({
      user_id: userId,
      film_id: itemId,
      access_type: "purchased",
      expires_at: null,
    });
  }

  if (paymentType === "film_rent" && itemId) {
    const expiry = new Date(Date.now() + 48 * 60 * 60 * 1000);

    await supabaseAdmin.from("film_access").upsert({
      user_id: userId,
      film_id: itemId,
      access_type: "rented",
      expires_at: expiry.toISOString(),
    });
  }

  if (paymentType === "subscription") {
    const expiry = new Date();
    expiry.setMonth(expiry.getMonth() + 1);

    await supabaseAdmin
      .from("profiles")
      .update({
        subscription_expires_at: expiry.toISOString(),
      })
      .eq("id", userId);
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});