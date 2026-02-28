# 🦞 Creem × React Native — Integration Demo

> Accept payments in your React Native app using **Creem** as a Merchant of Record.
> No Apple/Google in-app purchase headaches. Full tax & compliance coverage in 100+ countries.

---

## 📁 Project Structure

```
creem-demo/
├── app/
│   ├── _layout.tsx      ← Root layout + deep link handler
│   ├── index.tsx        ← Product listing / buy screen
│   ├── success.tsx      ← Post-payment verification screen
│   └── account.tsx      ← Subscription status screen
├── server/
│   └── index.ts         ← Express backend (checkout + webhooks)
├── app.json             ← Expo config (URL scheme + deep link)
└── package.json
```

---

## ⚡ Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/you/creem-demo
cd creem-demo

# Node 20+ recommended (tested on Node 22)

# Install app dependencies
npm install

# Install server dependencies
cd server && npm install && cd ..
```

### 2. Set Up Creem Dashboard

1. Sign up at [creem.io](https://creem.io) — free to start
2. Toggle **Test Mode** in the top nav
3. Create two products (Starter + Pro) and copy their IDs
4. Go to **Developers** → copy your **Test API Key**
5. Create a webhook endpoint (see §Webhooks below) and copy the secret

### 3. Configure Environment

```bash
# Server
cp server/.env.example server/.env
# then edit server/.env with your real test keys
# If testing on a physical device, also set:
# PUBLIC_BASE_URL=http://YOUR_MACHINE_LAN_IP:3000
```

```typescript
// app/index.tsx — update the product IDs
const PLANS = [
  { productId: "prod_YOUR_STARTER_ID", ... },
  { productId: "prod_YOUR_PRO_ID",     ... },
]
```

```typescript
// app/index.tsx + app/success.tsx — update API base for your device
// On simulator:  http://localhost:3000
// On real device: http://YOUR_MACHINE_LAN_IP:3000  (e.g. http://192.168.1.5:3000)
const API_BASE = "http://localhost:3000";
```

### 4. Start the Backend

```bash
npm run server
# → 🚀 Creem demo backend running on http://localhost:3000
```

### 5. Start the Expo App

```bash
# In the root directory
npm start

# Press i for iOS simulator, a for Android emulator
```

---

## 📱 iOS Setup

### Simulator
Everything works out of the box. Deep links are handled automatically.

### Physical Device (Expo Go)
```bash
# Update API_BASE in index.tsx and success.tsx to your machine's LAN IP
const API_BASE = "http://192.168.1.X:3000";

# Scan the QR code with the Expo Go app
npx expo start
```

### Physical Device (Production Build)
```bash
# Register the URL scheme in app.json (already configured):
# "scheme": "creemapp"

# Build with EAS
npx eas build --platform ios --profile preview
```

**Test the deep link on iOS simulator:**
```bash
xcrun simctl openurl booted "creemapp://payment-success?checkout_id=ch_test_123"
```

---

## 🤖 Android Setup

### Emulator
```bash
npx expo start --android
```

The intent filter in `app.json` handles `creemapp://` links automatically.

### Physical Device
```bash
# Same LAN IP requirement as iOS
const API_BASE = "http://192.168.1.X:3000";

npx expo start
# Scan QR with Expo Go
```

**Test the deep link on Android emulator:**
```bash
adb shell am start \
  -W -a android.intent.action.VIEW \
  -d "creemapp://payment-success?checkout_id=ch_test_123" \
  io.creem.demo
```

**Production Build:**
```bash
npx eas build --platform android --profile preview
```

---

## 🔄 Payment Flow

```
User taps "Buy"
    │
    ▼
[App] POST /checkout → { productId }
    │
    ▼
[Server] POST https://test-api.creem.io/v1/checkouts
         success_url = "creemapp://payment-success?checkout_id={CHECKOUT_ID}"
    │
    ▼
[Server] → { checkoutUrl, checkoutId }
    │
    ▼
[App] Linking.openURL(checkoutUrl)
    │
    ▼
[Browser] User completes Creem hosted checkout
    │
    ▼
[Creem] Redirects to: creemapp://payment-success?checkout_id=ch_xxx
    │
    ▼
[App] _layout.tsx deep link handler fires
    │
    ▼
[App] router.push("/success", { checkoutId: "ch_xxx" })
    │
    ▼
[App] GET /verify-checkout/ch_xxx  ← SERVER-SIDE verification
    │
    ▼
[Server] GET https://test-api.creem.io/v1/checkouts/ch_xxx
    │
    ▼
[App] status === "completed" → save to AsyncStorage → show receipt
```

---

## 🪝 Webhooks

Creem sends server-to-server events for async payment lifecycle events.

### Local Development with ngrok

```bash
# Install ngrok: https://ngrok.com
ngrok http 3000

# Copy the https URL, e.g.: https://abc123.ngrok.io
```

In Creem Dashboard → Developers → Webhooks:
- **Endpoint URL**: `https://abc123.ngrok.io/webhook`
- **Events**: Select all (or at minimum: checkout.completed, subscription.*)

### Events to Handle

| Event | What to do in your app |
|-------|----------------------|
| `checkout.completed` | Provision access, send welcome email |
| `subscription.active` | Activate premium features |
| `subscription.paid` | Extend subscription period |
| `subscription.canceled` | Schedule access removal at period end |
| `subscription.past_due` | Restrict features, trigger dunning |
| `refund.created` | Revoke access if full refund |

### Verification (critical!)

Never skip signature verification — our server does this with HMAC-SHA256:

```typescript
const computed = crypto
  .createHmac("sha256", CREEM_WEBHOOK_SECRET)
  .update(rawBody)
  .digest("hex");

// Use constant-time comparison to prevent timing attacks
crypto.timingSafeEqual(
  Buffer.from(computed, "hex"),
  Buffer.from(signature, "hex")
);
```

---

## 🆚 Why Creem vs. Apple In-App Purchases?

| | Apple IAP (StoreKit) | Creem MoR |
|---|---|---|
| **Apple's 30% cut** | ✅ Yes, always | ❌ No — 3.9% + 40¢ |
| **Platform restriction** | iOS only | iOS + Android + Web |
| **Tax compliance** | You handle | Creem handles |
| **Subscription management** | Limited | Full API |
| **Sandbox complexity** | High | Simple test mode |
| **Approval required** | Per feature | None |
| **Revenue splits** | No | Built-in |
| **Affiliate program** | No | Built-in |
| **Direct customer relationship** | Apple owns it | You own it |

### The Key Insight

Creem is a **Merchant of Record** — meaning *Creem* is the legal seller, not you.
This means:
- Creem collects and remits VAT/GST in 100+ countries automatically
- You're never liable for tax compliance
- No need for StoreKit, BillingClient, or IAP review processes
- Your checkout is a **web page** — works everywhere, updates instantly

> ⚠️ **Apple Developer Guidelines**: Creem works for digital content sold 
> outside the App Store binary (e.g., SaaS subscriptions, content accessed 
> via web login, B2B software). For goods or content *delivered through the 
> iOS app binary* (games, app features), Apple IAP is still required per 
> App Store guidelines. Creem is ideal for hybrid and web-first apps.

---

## 🧪 Test Cards

Use these with Creem's test mode:

| Card Number | Result |
|-------------|--------|
| `4242 4242 4242 4242` | ✅ Success |
| `4000 0000 0000 0002` | ❌ Declined |
| `4000 0000 0000 9995` | ❌ Insufficient funds |

Any future expiry date, any CVV, any billing address.

---

## 🚀 Going to Production

1. Toggle off Test Mode in Creem dashboard
2. Swap `CREEM_API_KEY` for your live key
3. Set `NODE_ENV=production` on your server
4. Update webhook URL to your production server
5. Deploy backend to Railway / Render / Fly.io
6. Build production app with `npx eas build --platform all`

---

## 📦 Tech Stack

| Layer | Tech |
|-------|------|
| Mobile | Expo (React Native) with Expo Router |
| Deep Links | `expo-linking` + URL scheme `creemapp://` |
| Local Storage | `@react-native-async-storage/async-storage` |
| Backend | Node.js + Express + TypeScript |
| Payments | [Creem API](https://docs.creem.io) |
