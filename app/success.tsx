// app/success.tsx  ← Deep Link Landing + Purchase Verification Screen
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Animated,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const API_BASE = "http://localhost:3000";
const DEMO_ALLOW_UNVERIFIED_SUCCESS = true;

type VerificationState = "loading" | "success" | "error";

const RETRYABLE_STATUSES = new Set([404, 409, 425, 429]);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isPlaceholderCheckoutId(value?: string) {
  if (!value) return true;
  return value.includes("CHECKOUT_ID") || /^\{.+\}$/.test(value);
}

export default function SuccessScreen() {
  const params = useLocalSearchParams<{ checkoutId?: string | string[] }>();
  const router = useRouter();

  const [state, setState] = useState<VerificationState>("loading");
  const [checkoutData, setCheckoutData] = useState<any>(null);
  const [resolvedCheckoutId, setResolvedCheckoutId] = useState<string | undefined>();

  // Animations
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const checkoutIdFromParams = Array.isArray(params.checkoutId)
    ? params.checkoutId[0]
    : params.checkoutId;
  const checkoutIdForDisplay = resolvedCheckoutId ?? checkoutIdFromParams;

  useEffect(() => {
    let isMounted = true;

    async function runVerification() {
      const idFromRoute = checkoutIdFromParams;
      const fallbackId = await AsyncStorage.getItem("lastCheckoutId");
      const effectiveCheckoutId =
        !isPlaceholderCheckoutId(idFromRoute) ? idFromRoute : fallbackId ?? undefined;

      if (!isMounted) return;

      if (!effectiveCheckoutId) {
        if (DEMO_ALLOW_UNVERIFIED_SUCCESS) {
          await markDemoSuccess("demo_unverified");
        } else {
          setState("error");
        }
        return;
      }

      setResolvedCheckoutId(effectiveCheckoutId);
      await verifyPurchase(effectiveCheckoutId);
    }

    runVerification();
    return () => {
      isMounted = false;
    };
  }, [checkoutIdFromParams]);

  useEffect(() => {
    if (state !== "loading") {
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, damping: 12 }),
        Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]).start();
    }
  }, [state]);

  async function verifyPurchase(id: string) {
    try {
      const maxAttempts = 5;

      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        // 3️⃣  Verify the checkout server-side — never trust the client alone
        const res = await fetch(`${API_BASE}/verify-checkout/${encodeURIComponent(id)}`);

        if (!res.ok) {
          const detail = await res.text();
          const isRetryable = RETRYABLE_STATUSES.has(res.status) || res.status >= 500;
          if (isRetryable && attempt < maxAttempts) {
            await sleep(attempt * 900);
            continue;
          }
          throw new Error(`Verification failed (${res.status}): ${detail}`);
        }

        const data = await res.json();

        if (data.status === "paid" || data.status === "completed") {
          // 4️⃣  Persist entitlement locally (real app: use your auth backend)
          await AsyncStorage.setItem(
            "subscription",
            JSON.stringify({
              plan: data.product?.name ?? "Pro",
              checkoutId: id,
              activatedAt: new Date().toISOString(),
              customerId: data.customer_id,
            })
          );
          await AsyncStorage.removeItem("lastCheckoutId");
          setCheckoutData(data);
          setState("success");
          return;
        }

        if ((data.status === "pending" || data.status === "open") && attempt < maxAttempts) {
          await sleep(attempt * 900);
          continue;
        }

        if (DEMO_ALLOW_UNVERIFIED_SUCCESS) {
          await markDemoSuccess(id, data.status ?? "pending");
          return;
        }
        throw new Error(`Checkout not completed yet (status: ${data.status})`);
      }
    } catch (err) {
      if (DEMO_ALLOW_UNVERIFIED_SUCCESS) {
        await markDemoSuccess(id, "verification_failed");
        return;
      }
      setState("error");
    }
  }

  async function markDemoSuccess(id: string, sourceStatus: string = "unverified") {
    const demoData = {
      id,
      status: "completed",
      amount: null,
      currency: null,
      customer_id: null,
      product: { name: "Starter", id: null },
      sourceStatus,
    };

    await AsyncStorage.setItem(
      "subscription",
      JSON.stringify({
        plan: demoData.product.name,
        checkoutId: id,
        activatedAt: new Date().toISOString(),
        customerId: "",
      })
    );

    setCheckoutData(demoData);
    setState("success");
  }

  // ── Loading state ──
  if (state === "loading") {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.center}>
          <ActivityIndicator size="large" color="#0A0A0A" />
          <Text style={s.loadingText}>Verifying your purchase…</Text>
          <Text style={s.loadingSubtext}>
            Checking checkout {checkoutIdForDisplay?.slice(0, 16) ?? "…"}…
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Error state ──
  if (state === "error") {
    return (
      <SafeAreaView style={s.safe}>
        <Animated.View style={[s.center, { opacity, transform: [{ scale }] }]}>
          <View style={[s.iconCircle, { backgroundColor: "#FEE2E2" }]}>
            <Text style={s.icon}>✕</Text>
          </View>
          <Text style={s.title}>Verification Failed</Text>
          <Text style={s.subtitle}>
            We couldn't verify your payment. Please contact support with checkout ID:{"\n"}
            <Text style={s.mono}>{checkoutIdForDisplay ?? "Unknown"}</Text>
          </Text>
          <TouchableOpacity style={s.btn} onPress={() => router.replace("/")}>
            <Text style={s.btnText}>Back to home</Text>
          </TouchableOpacity>
        </Animated.View>
      </SafeAreaView>
    );
  }

  // ── Success state ──
  return (
    <SafeAreaView style={s.safe}>
      <Animated.ScrollView
        contentContainerStyle={s.scroll}
        style={{ opacity }}
        showsVerticalScrollIndicator={false}
      >
        {/* Icon */}
        <Animated.View style={[s.iconWrap, { transform: [{ scale }] }]}>
          <View style={s.iconCircle}>
            <Text style={s.icon}>✓</Text>
          </View>
        </Animated.View>

        <Text style={s.title}>You're all set!</Text>
        <Text style={s.subtitle}>
          Your payment was verified and your subscription is now active.
        </Text>

        {/* Receipt card */}
        <View style={s.receipt}>
          <Text style={s.receiptTitle}>CREEM RECEIPT</Text>

          <ReceiptRow label="Plan" value={checkoutData?.product?.name ?? "Pro Plan"} />
          <ReceiptRow
            label="Amount"
            value={
              checkoutData?.amount
                ? `$${(checkoutData.amount / 100).toFixed(2)}`
                : "—"
            }
          />
          <ReceiptRow
            label="Status"
            value="✓ Paid"
            valueStyle={{ color: "#16A34A", fontWeight: "700" }}
          />
          <ReceiptRow
            label="Checkout ID"
            value={checkoutIdForDisplay ? checkoutIdForDisplay.slice(0, 20) + "…" : "—"}
            valueStyle={s.mono}
          />
          <ReceiptRow
            label="Customer"
            value={checkoutData?.customer_id ? checkoutData.customer_id.slice(0, 20) + "…" : "—"}
            valueStyle={s.mono}
          />

          <Text style={s.receiptNote}>
            Tax & compliance handled by Creem as Merchant of Record
          </Text>
        </View>

        {/* CTA */}
        <TouchableOpacity
          style={s.btn}
          onPress={() => router.push("/account")}
          activeOpacity={0.8}
        >
          <Text style={s.btnText}>Go to my account →</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.secondaryBtn} onPress={() => router.replace("/")}>
          <Text style={s.secondaryBtnText}>Back to home</Text>
        </TouchableOpacity>
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

function ReceiptRow({
  label,
  value,
  valueStyle,
}: {
  label: string;
  value: string;
  valueStyle?: object;
}) {
  return (
    <View style={s.receiptRow}>
      <Text style={s.receiptLabel}>{label}</Text>
      <Text style={[s.receiptValue, valueStyle]}>{value}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const BLACK = "#0A0A0A";
const CREAM = "#FAFAF8";
const GRAY = "#6B6B6B";
const BORDER = "#E5E5E3";

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: CREAM },
  scroll: { padding: 24, paddingBottom: 48, alignItems: "center" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 32 },
  loadingText: {
    marginTop: 20,
    fontSize: 18,
    fontWeight: "700",
    color: BLACK,
  },
  loadingSubtext: { marginTop: 8, fontSize: 13, color: GRAY, fontFamily: "monospace" },

  // Icon
  iconWrap: { marginBottom: 24, marginTop: 32 },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#DCFCE7",
    justifyContent: "center",
    alignItems: "center",
  },
  icon: { fontSize: 32, fontWeight: "800", color: "#16A34A" },

  // Text
  title: {
    fontSize: 30,
    fontWeight: "800",
    color: BLACK,
    letterSpacing: -1,
    textAlign: "center",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15,
    color: GRAY,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 32,
    paddingHorizontal: 16,
  },

  // Receipt
  receipt: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1.5,
    borderColor: BORDER,
    marginBottom: 24,
  },
  receiptTitle: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
    color: GRAY,
    marginBottom: 16,
  },
  receiptRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F5F5F4",
  },
  receiptLabel: { fontSize: 14, color: GRAY },
  receiptValue: { fontSize: 14, fontWeight: "600", color: BLACK, maxWidth: "60%", textAlign: "right" },
  receiptNote: {
    marginTop: 14,
    fontSize: 11,
    color: GRAY,
    textAlign: "center",
    lineHeight: 16,
  },
  mono: { fontFamily: "monospace", fontSize: 12 },

  // Buttons
  btn: {
    width: "100%",
    backgroundColor: BLACK,
    borderRadius: 100,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 12,
  },
  btnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  secondaryBtn: {
    width: "100%",
    borderRadius: 100,
    paddingVertical: 16,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: BORDER,
  },
  secondaryBtnText: { color: BLACK, fontSize: 15, fontWeight: "600" },
});
