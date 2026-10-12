import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const encoder = new TextEncoder();

function signatureParts(header: string) {
  const values = new Map<string, string[]>();
  for (const segment of header.split(";")) {
    const i = segment.indexOf("=");
    if (i <= 0) continue;
    const key = segment.slice(0, i).trim();
    values.set(key, [...(values.get(key) ?? []), segment.slice(i + 1).trim()]);
  }
  return { timestamp: values.get("ts")?.[0], signatures: values.get("h1") ?? [] };
}

function constantTimeHexEqual(a: string, b: string) {
  if (!/^[0-9a-f]+$/i.test(a) || a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.toLowerCase().charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

async function verifyPaddleSignature(raw: Uint8Array, header: string, secret: string) {
  const { timestamp, signatures } = signatureParts(header);
  if (!timestamp || !/^\d+$/.test(timestamp) || !signatures.length) return false;
  const seconds = Number(timestamp);
  if (!Number.isSafeInteger(seconds) || Math.abs(Date.now() / 1000 - seconds) > 300) return false;
  const prefix = encoder.encode(`${timestamp}:`);
  const payload = new Uint8Array(prefix.length + raw.length);
  payload.set(prefix);
  payload.set(raw, prefix.length);
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, payload));
  const expected = Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join("");
  return signatures.some((signature) => constantTimeHexEqual(signature, expected));
}

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

type PaddleItem = { price?: { id?: string }; quantity?: number };
type PaddleTransaction = {
  id?: string;
  status?: string;
  custom_data?: Record<string, unknown> | null;
  items?: PaddleItem[];
  currency_code?: string;
  details?: { totals?: { total?: string } };
};
type PaddleEvent = { event_id?: string; event_type?: string; data?: PaddleTransaction };

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const secret = Deno.env.get("PADDLE_WEBHOOK_SECRET");
  const signature = req.headers.get("Paddle-Signature");
  if (!secret || !signature) return new Response("Missing webhook configuration/signature", { status: 400 });
  const raw = new Uint8Array(await req.arrayBuffer());
  if (!(await verifyPaddleSignature(raw, signature, secret))) return new Response("Invalid signature", { status: 401 });

  let event: PaddleEvent;
  try { event = JSON.parse(new TextDecoder().decode(raw)); }
  catch { return new Response("Invalid JSON", { status: 400 }); }
  if (!event.event_id || !event.event_type) return new Response("Malformed event", { status: 400 });
  if (event.event_type !== "transaction.completed") return Response.json({ received: true });

  const transaction = event.data;
  if (!transaction?.id || transaction.status !== "completed") return json(400, { error: "Transaction is not completed." });
  const custom = transaction.custom_data ?? {};
  const userId = typeof custom.user_id === "string" ? custom.user_id : "";
  if (!userId) return json(400, { error: "Missing user reference." });

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json(500, { error: "Supabase webhook configuration is missing." });
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const productType = typeof custom.product_type === "string" ? custom.product_type : "";
  const paymentType = typeof custom.payment_type === "string" ? custom.payment_type : "";
  const total = Number(transaction.details?.totals?.total ?? NaN);
  const amountCents = Number.isFinite(total) ? Math.round(total) : 0;
  const currency = transaction.currency_code?.toLowerCase() || "usd";

  if (productType === "film") {
    const filmId = typeof custom.product_id === "string" ? custom.product_id : "";
    if (!filmId) return json(400, { error: "Film purchase metadata is missing." });

    const { data: film, error: filmError } = await admin
      .from("films")
      .select("id,access_type,price_cents,paddle_price_id")
      .eq("id", filmId)
      .maybeSingle();
    if (filmError) return json(503, { error: "Could not validate film purchase." });
    if (!film || film.access_type !== "paid" || !film.paddle_price_id) return json(400, { error: "Film is not configured for paid checkout." });

    const priceIds = (transaction.items ?? []).map((item) => item.price?.id).filter(Boolean);
    if (!priceIds.includes(film.paddle_price_id)) return json(400, { error: "Transaction price does not match the film catalog price." });
    if (!Number.isFinite(total) || total <= 0) return json(400, { error: "Completed transaction total is invalid." });

    const { error: purchaseError } = await admin.from("purchases").upsert({
      user_id: userId,
      film_id: filmId,
      purchase_type: "buy",
      price_cents: amountCents,
      purchased_at: new Date().toISOString(),
      expires_at: null,
      paddle_transaction_id: transaction.id,
    }, { onConflict: "paddle_transaction_id" });
    if (purchaseError) return json(503, { error: "Could not record film purchase." });

    const { error: accessError } = await admin.from("film_access").upsert({
      user_id: userId,
      film_id: filmId,
      access_type: "purchased",
      expires_at: null,
    }, { onConflict: "user_id,film_id" });
    if (accessError) return json(503, { error: "Could not provision film access." });
    return Response.json({ received: true, provisioned: true });
  }

  const isCartPurchase = paymentType === "cart";
  const singleProductId = typeof custom.product_id === "string" ? custom.product_id : "";
  if (!isCartPurchase && !(productType === "game" && singleProductId)) {
    return Response.json({ received: true });
  }

  const listedIds = isCartPurchase && typeof custom.product_ids === "string"
    ? custom.product_ids.split(",").filter(Boolean)
    : singleProductId ? [singleProductId] : [];
  if (!listedIds.length) return json(400, { error: "Cart purchase metadata is missing product IDs." });

  const { data: products, error: productsError } = await admin
    .from("products")
    .select("id,paddle_price_id,is_published")
    .in("id", listedIds);
  if (productsError) return json(503, { error: "Could not validate purchased products." });
  if (!products || products.length !== listedIds.length || products.some((p) => !p.is_published || !p.paddle_price_id)) {
    return json(400, { error: "One or more products are unavailable or missing a Paddle price." });
  }

  const transactionPriceIds = new Set((transaction.items ?? []).map((item) => item.price?.id).filter(Boolean));
  if (products.some((p) => !transactionPriceIds.has(p.paddle_price_id))) {
    return json(400, { error: "Transaction prices do not match the product catalog." });
  }
  if (!Number.isFinite(total) || total <= 0) return json(400, { error: "Completed transaction total is invalid." });

  const { data: priorPayment, error: priorError } = await admin
    .from("payments")
    .select("id")
    .eq("metadata->>paddle_transaction_id", transaction.id)
    .maybeSingle();
  if (priorError) return json(503, { error: "Could not check transaction history." });

  let paymentId = priorPayment?.id;
  if (!paymentId) {
    const { data: payment, error: paymentError } = await admin
      .from("payments")
      .insert({
        user_id: userId,
        payment_type: "product",
        item_id: products.length === 1 ? products[0].id : null,
        amount_cents: amountCents,
        currency,
        status: "paid",
        metadata: { paddle_transaction_id: transaction.id, product_ids: listedIds, transaction },
      })
      .select("id")
      .single();
    if (paymentError) return json(503, { error: "Could not record product payment." });
    paymentId = payment.id;
  }

  const purchases = listedIds.map((productId) => ({
    user_id: userId,
    product_id: productId,
    payment_id: paymentId,
  }));
  const { error: purchaseError } = await admin
    .from("product_purchases")
    .upsert(purchases, { onConflict: "user_id,product_id" });
  if (purchaseError) return json(503, { error: "Could not add purchased products to the Library." });

  if (isCartPurchase) {
    const { error: clearError } = await admin
      .from("cart_items")
      .delete()
      .eq("user_id", userId)
      .in("product_id", listedIds);
    if (clearError) return json(503, { error: "Purchase recorded; paid cart items were not cleared." });
  }

  return Response.json({ received: true, provisioned: true });
});
