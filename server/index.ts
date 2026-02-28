// server/index.ts
// Run with: npx ts-node server/index.ts
// Or: npx tsx server/index.ts

import express from "express";
import crypto from "crypto";
import type { Request } from "express";

const app = express();

// ── Config ────────────────────────────────────────────────────────────────────
const PORT = 3000;
const CREEM_API_KEY = process.env.CREEM_API_KEY ?? "creem_test_YOUR_KEY";
const CREEM_WEBHOOK_SECRET = process.env.CREEM_WEBHOOK_SECRET ?? "whsec_YOUR_SECRET";

// Use test API in development, production in prod
const CREEM_BASE_URL =
  process.env.NODE_ENV === "production"
    ? "https://api.creem.io/v1"
    : "https://test-api.creem.io/v1";

// Our app's deep link scheme — matches app.json "scheme": "creemapp"
const APP_SCHEME = "creemapp";

function getPublicBaseUrl(req: Request): string {
  const configured = process.env.PUBLIC_BASE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");

  const host = req.get("x-forwarded-host") ?? req.get("host");
  const proto = req.get("x-forwarded-proto") ?? req.protocol;
  if (!host) {
    throw new Error("Cannot determine public base URL. Set PUBLIC_BASE_URL in server/.env");
  }
  return `${proto}://${host}`;
}

// ── Middleware ────────────────────────────────────────────────────────────────
// IMPORTANT: For webhook signature verification we need the raw body,
// so we parse it manually only for the /webhook route.
app.use("/webhook", express.raw({ type: "application/json" }));
app.use(express.json());

// Creem requires success/cancel URLs to be http(s). These endpoints bridge
// browser redirects back into the native app deep link scheme.
app.get("/payment-success", (req, res) => {
  const checkoutId =
    typeof req.query.checkout_id === "string" ? req.query.checkout_id : undefined;
  const deepLink = checkoutId
    ? `${APP_SCHEME}://payment-success?checkout_id=${encodeURIComponent(checkoutId)}`
    : `${APP_SCHEME}://payment-success`;
  res.redirect(302, deepLink);
});

app.get("/payment-cancelled", (_req, res) => {
  res.redirect(302, `${APP_SCHEME}://`);
});

// ── 1. Create Checkout Session ─────────────────────────────────────────────
// Called by the React Native app to initiate a payment.
// We do this server-side so the API key is never exposed to the client.
app.post("/checkout", async (req, res) => {
  const { productId, planName } = req.body;

  if (!productId) {
    return res.status(400).json({ error: "productId is required" });
  }

  try {
    // Creem requires http(s) URLs. After hitting this URL we redirect into
    // the app deep link in /payment-success.
    const publicBaseUrl = getPublicBaseUrl(req);
    const successUrl = `${publicBaseUrl}/payment-success?checkout_id={CHECKOUT_ID}`;
    const response = await fetch(`${CREEM_BASE_URL}/checkouts`, {
      method: "POST",
      headers: {
        "x-api-key": CREEM_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        product_id: productId,
        success_url: successUrl,
        // Optional: pre-fill customer info if you have it
        // customer_email: req.body.email,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Creem error:", err);
      return res.status(response.status).json({ error: "Creem API error", detail: err });
    }

    const session = await response.json();

    // Return the hosted checkout URL to the mobile client
    // The app will open this with Linking.openURL()
    res.json({
      checkoutUrl: session.checkout_url,
      checkoutId: session.id,
    });
  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── 2. Verify Checkout ─────────────────────────────────────────────────────
// Called by the app after deep link redirect to confirm payment status.
// NEVER trust the client to self-report successful payment.
app.get("/verify-checkout/:checkoutId", async (req, res) => {
  const { checkoutId } = req.params;

  try {
    const response = await fetch(
      `${CREEM_BASE_URL}/checkouts?checkout_id=${encodeURIComponent(checkoutId)}`,
      {
        headers: { "x-api-key": CREEM_API_KEY },
      }
    );

    if (!response.ok) {
      const detail = await response.text();
      console.error(`Verify checkout failed for ${checkoutId}:`, detail);
      return res.status(response.status).json({
        error: "Checkout lookup failed",
        detail,
      });
    }

    const checkout = await response.json();

    // Return only the fields the mobile client needs
    res.json({
      id: checkout.id,
      status: checkout.status,         // "completed" | "pending" | "expired"
      amount: checkout.amount ?? null,
      currency: checkout.currency ?? null,
      customer_id: checkout.customer_id ?? null,
      product: {
        name: typeof checkout.product === "object" ? checkout.product?.name : null,
        id: typeof checkout.product === "string" ? checkout.product : checkout.product?.id,
      },
    });
  } catch (err) {
    console.error("Verify error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── 3. Webhooks ────────────────────────────────────────────────────────────
// Creem calls this endpoint when async events occur (subscription renewals,
// cancellations, refunds, etc). This is how mobile apps stay in sync
// without having to poll.
//
// In production: update your database here, push notifications to users,
// revoke access on cancellation, etc.
app.post("/webhook", (req, res) => {
  const signature = req.headers["creem-signature"] as string;
  const rawBody = req.body as Buffer;

  // ── Signature verification — never skip this ──
  if (!verifyWebhookSignature(rawBody, CREEM_WEBHOOK_SECRET, signature)) {
    console.warn("⚠️  Webhook signature mismatch — rejecting request");
    return res.status(401).json({ error: "Invalid signature" });
  }

  const event = JSON.parse(rawBody.toString());
  console.log(`\n📬 Webhook: ${event.eventType}`);

  switch (event.eventType) {
    case "checkout.completed": {
      const checkout = event.object;
      console.log(`  ✅ Checkout completed: ${checkout.id}`);
      console.log(`  👤 Customer: ${checkout.customer_id}`);
      console.log(`  💳 Amount: $${checkout.amount / 100} ${checkout.currency}`);
      // TODO: provision access in your database
      break;
    }

    case "subscription.active": {
      const sub = event.object;
      console.log(`  🟢 Subscription active: ${sub.id}`);
      console.log(`  📦 Product: ${sub.product_id}`);
      // TODO: activate features for customer
      break;
    }

    case "subscription.paid": {
      const sub = event.object;
      console.log(`  💰 Subscription renewed: ${sub.id}`);
      // TODO: extend access, update expiry date
      break;
    }

    case "subscription.canceled": {
      const sub = event.object;
      console.log(`  ❌ Subscription cancelled: ${sub.id}`);
      // TODO: revoke access at period end
      break;
    }

    case "subscription.past_due": {
      const sub = event.object;
      console.log(`  ⏰ Payment failed / past due: ${sub.id}`);
      // TODO: send dunning email, restrict features
      break;
    }

    case "refund.created": {
      const refund = event.object;
      console.log(`  💸 Refund issued: ${refund.id}`);
      // TODO: revoke access if full refund
      break;
    }

    default:
      console.log(`  ℹ️  Unhandled event type: ${event.eventType}`);
  }

  // Respond 200 quickly — Creem retries if you don't
  res.status(200).json({ received: true });
});

// ── Utility: Signature Verification ──────────────────────────────────────
function verifyWebhookSignature(
  payload: Buffer,
  secret: string,
  signature: string
): boolean {
  if (!signature) return false;
  const computed = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");
  // Constant-time comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(computed, "hex"),
      Buffer.from(signature, "hex")
    );
  } catch {
    return false;
  }
}

// ── Start ─────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 Creem demo backend running on http://localhost:${PORT}`);
  console.log(`   Mode: ${CREEM_BASE_URL.includes("test") ? "TEST 🧪" : "PRODUCTION 🔴"}`);
  console.log(`\nEndpoints:`);
  console.log(`  POST /checkout           → create Creem checkout session`);
  console.log(`  GET  /verify-checkout/:id → verify payment status`);
  console.log(`  POST /webhook            → receive Creem webhook events\n`);
});
