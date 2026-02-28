// app/index.tsx  ← Home / Product Listing Screen
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Alert,
  StatusBar,
} from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

// ─── Config ──────────────────────────────────────────────────────────────────
// Point this at your running backend (use your machine's LAN IP when on device)
const API_BASE = "http://localhost:3000";

// ─── Data ─────────────────────────────────────────────────────────────────────
type Plan = {
  id: string;
  productId: string;
  name: string;
  price: string;
  period: string;
  tagline: string;
  features: string[];
  highlight: boolean;
  badge?: string;
};

const PLANS: Plan[] = [
  {
    id: "Supadupa Starter Pack",
    productId: "prod_7MOKhKUu5zUnMBsfcSqLoa", // ← replace with your Creem product ID
    name: "Starter",
    price: "$9",
    period: "/ one time",
    tagline: "Perfect for indie devs",
    features: ["1 Project", "10k API calls / mo", "Email support", "Basic analytics"],
    highlight: false,
  },

];

// ─── Component ────────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function handleBuy(plan: Plan) {
    try {
      setLoading(plan.id);

      // 1️⃣  Ask our backend to create a Creem checkout session
      const res = await fetch(`${API_BASE}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: plan.productId,
          planName: plan.name,
        }),
      });

      if (!res.ok) throw new Error("Failed to create checkout");

      const { checkoutUrl, checkoutId } = await res.json();
      if (!checkoutUrl || !checkoutId) {
        throw new Error("Missing checkout session data");
      }

      // Keep a local fallback in case redirect query params are delayed/placeholder.
      await AsyncStorage.setItem("lastCheckoutId", checkoutId);

      // 2️⃣  Open Creem's hosted checkout inside the app in a WebView screen
      router.push({ pathname: "/checkout", params: { checkoutUrl, checkoutId } });
    } catch (err) {
      Alert.alert("Error", "Could not start checkout. Is the backend running?");
    } finally {
      setLoading(null);
    }
  }

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAFAF8" />
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={s.header}>
          <View style={s.logoRow}>
            <View style={s.logoMark} />
            <Text style={s.logoText}>Creem</Text>
          </View>
          <Text style={s.headline}>Choose your plan</Text>
          <Text style={s.subheadline}>
            Payments, taxes & compliance — all handled for you.
          </Text>
        </View>

        {/* Plan cards */}
        {PLANS.map((plan) => (
          <View key={plan.id} style={[s.card, plan.highlight && s.cardHighlight]}>
            {plan.badge && (
              <View style={s.badge}>
                <Text style={s.badgeText}>{plan.badge}</Text>
              </View>
            )}

            <Text style={[s.planName, plan.highlight && s.planNameLight]}>
              {plan.name}
            </Text>
            <Text style={[s.planTagline, plan.highlight && s.textLight]}>
              {plan.tagline}
            </Text>

            <View style={s.priceRow}>
              <Text style={[s.price, plan.highlight && s.planNameLight]}>
                {plan.price}
              </Text>
              <Text style={[s.period, plan.highlight && s.textLight]}>
                {plan.period}
              </Text>
            </View>

            <View style={s.divider} />

            {plan.features.map((f) => (
              <View key={f} style={s.featureRow}>
                <Text style={[s.checkmark, plan.highlight && s.checkmarkLight]}>✓</Text>
                <Text style={[s.featureText, plan.highlight && s.textLight]}>{f}</Text>
              </View>
            ))}

            <TouchableOpacity
              style={[s.buyBtn, plan.highlight ? s.buyBtnLight : s.buyBtnDark]}
              onPress={() => handleBuy(plan)}
              activeOpacity={0.8}
            >
              {loading === plan.id ? (
                <ActivityIndicator color={plan.highlight ? "#0A0A0A" : "#fff"} />
              ) : (
                <Text
                  style={[
                    s.buyBtnText,
                    plan.highlight ? s.buyBtnTextDark : s.buyBtnTextLight,
                  ]}
                >
                  Get {plan.name} →
                </Text>
              )}
            </TouchableOpacity>
          </View>
        ))}

        {/* Footer note */}
        <Text style={s.footer}>
          Powered by Creem · Merchant of Record · Tax & compliance handled
        </Text>

        {/* Navigate to account (for demo purposes) */}
        <TouchableOpacity style={s.accountLink} onPress={() => router.push("/account")}>
          <Text style={s.accountLinkText}>View my subscription →</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const ORANGE = "#F97316";
const BLACK = "#0A0A0A";
const CREAM = "#FAFAF8";
const GRAY = "#6B6B6B";
const BORDER = "#E5E5E3";

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: CREAM },
  scroll: { paddingHorizontal: 20, paddingBottom: 48 },

  // Header
  header: { paddingTop: 32, paddingBottom: 28 },
  logoRow: { flexDirection: "row", alignItems: "center", marginBottom: 24 },
  logoMark: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: BLACK,
    marginRight: 8,
  },
  logoText: { fontSize: 20, fontWeight: "800", color: BLACK, letterSpacing: -0.5 },
  headline: {
    fontSize: 34,
    fontWeight: "800",
    color: BLACK,
    letterSpacing: -1,
    marginBottom: 8,
  },
  subheadline: { fontSize: 15, color: GRAY, lineHeight: 22 },

  // Cards
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: BORDER,
  },
  cardHighlight: {
    backgroundColor: BLACK,
    borderColor: BLACK,
  },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: ORANGE,
    borderRadius: 100,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 16,
  },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "700", letterSpacing: 0.3 },
  planName: {
    fontSize: 22,
    fontWeight: "800",
    color: BLACK,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  planNameLight: { color: "#fff" },
  planTagline: { fontSize: 13, color: GRAY, marginBottom: 16 },
  textLight: { color: "rgba(255,255,255,0.65)" },
  priceRow: { flexDirection: "row", alignItems: "flex-end", marginBottom: 20 },
  price: { fontSize: 44, fontWeight: "800", color: BLACK, letterSpacing: -2 },
  period: { fontSize: 15, color: GRAY, marginBottom: 8, marginLeft: 4 },
  divider: { height: 1, backgroundColor: BORDER, marginBottom: 16 },

  // Features
  featureRow: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  checkmark: { color: ORANGE, fontWeight: "800", fontSize: 14, marginRight: 10, width: 16 },
  checkmarkLight: { color: ORANGE },
  featureText: { fontSize: 14, color: BLACK, flex: 1 },

  // Buy button
  buyBtn: {
    borderRadius: 100,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 24,
  },
  buyBtnDark: { backgroundColor: BLACK },
  buyBtnLight: { backgroundColor: "#fff" },
  buyBtnText: { fontSize: 15, fontWeight: "700", letterSpacing: 0.2 },
  buyBtnTextLight: { color: "#fff" },
  buyBtnTextDark: { color: BLACK },

  // Footer
  footer: { textAlign: "center", fontSize: 12, color: GRAY, marginTop: 24, lineHeight: 18 },
  accountLink: { alignItems: "center", marginTop: 16 },
  accountLinkText: { color: ORANGE, fontSize: 14, fontWeight: "600" },
});
