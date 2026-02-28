// app/account.tsx  ← Subscription Status / Account Screen
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

type Subscription = {
  plan: string;
  checkoutId: string;
  activatedAt: string;
  customerId: string;
};

export default function AccountScreen() {
  const router = useRouter();
  const [sub, setSub] = useState<Subscription | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem("subscription").then((val) => {
      if (val) setSub(JSON.parse(val));
      setLoaded(true);
    });
  }, []);

  async function handleCancelSubscription() {
    Alert.alert(
      "Cancel subscription?",
      "This will send a cancellation request to Creem. You'll keep access until end of billing period.",
      [
        { text: "Keep plan", style: "cancel" },
        {
          text: "Cancel",
          style: "destructive",
          onPress: async () => {
            try {
              // In a real app: call your backend to cancel via Creem API
              // POST /v1/subscriptions/{id}/cancel
              await AsyncStorage.removeItem("subscription");
              setSub(null);
              Alert.alert("Cancelled", "Your subscription has been cancelled.");
            } catch {
              Alert.alert("Error", "Could not cancel. Please try again.");
            }
          },
        },
      ]
    );
  }

  if (!loaded) return null;

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Nav */}
        <TouchableOpacity style={s.back} onPress={() => router.back()}>
          <Text style={s.backText}>← Back</Text>
        </TouchableOpacity>

        <Text style={s.title}>My Account</Text>

        {sub ? (
          // ── Active subscription ──
          <>
            <View style={s.statusCard}>
              <View style={s.statusBadge}>
                <View style={s.statusDot} />
                <Text style={s.statusText}>Active</Text>
              </View>
              <Text style={s.planName}>{sub.plan} Plan</Text>
              <Text style={s.activatedAt}>
                Active since {new Date(sub.activatedAt).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </Text>
            </View>

            <View style={s.detailsCard}>
              <Text style={s.sectionTitle}>Subscription Details</Text>
              <DetailRow label="Plan" value={`${sub.plan} Plan`} />
              <DetailRow label="Billing" value="Monthly" />
              <DetailRow
                label="Checkout ID"
                value={sub.checkoutId.slice(0, 22) + "…"}
                mono
              />
              <DetailRow
                label="Customer ID"
                value={sub.customerId ? sub.customerId.slice(0, 22) + "…" : "—"}
                mono
              />
            </View>

            {/* What Creem handles */}
            <View style={s.morCard}>
              <Text style={s.morTitle}>🛡  Creem as Merchant of Record</Text>
              <Text style={s.morBody}>
                Creem handles all taxes, VAT/GST compliance, and payment processing in
                100+ countries — so you never have to think about it.
              </Text>
            </View>

            <TouchableOpacity style={s.manageBtn} activeOpacity={0.8}>
              <Text style={s.manageBtnText}>Manage billing on Creem →</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={s.cancelBtn}
              onPress={handleCancelSubscription}
              activeOpacity={0.8}
            >
              <Text style={s.cancelBtnText}>Cancel subscription</Text>
            </TouchableOpacity>
          </>
        ) : (
          // ── No subscription ──
          <>
            <View style={s.emptyCard}>
              <Text style={s.emptyIcon}>💳</Text>
              <Text style={s.emptyTitle}>No active subscription</Text>
              <Text style={s.emptySubtitle}>
                Pick a plan to unlock all features and start building.
              </Text>
            </View>

            <TouchableOpacity
              style={s.buyBtn}
              onPress={() => router.replace("/")}
              activeOpacity={0.8}
            >
              <Text style={s.buyBtnText}>View plans →</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function DetailRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <View style={s.detailRow}>
      <Text style={s.detailLabel}>{label}</Text>
      <Text style={[s.detailValue, mono && s.monoText]}>{value}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const BLACK = "#0A0A0A";
const CREAM = "#FAFAF8";
const GRAY = "#6B6B6B";
const ORANGE = "#F97316";
const GREEN = "#16A34A";
const BORDER = "#E5E5E3";

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: CREAM },
  scroll: { padding: 20, paddingBottom: 48 },

  back: { paddingVertical: 4, marginBottom: 8 },
  backText: { color: ORANGE, fontSize: 15, fontWeight: "600" },

  title: {
    fontSize: 30,
    fontWeight: "800",
    color: BLACK,
    letterSpacing: -1,
    marginBottom: 24,
  },

  // Status card
  statusCard: {
    backgroundColor: BLACK,
    borderRadius: 20,
    padding: 24,
    marginBottom: 16,
  },
  statusBadge: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#4ADE80", marginRight: 6 },
  statusText: { color: "#4ADE80", fontSize: 13, fontWeight: "600" },
  planName: { fontSize: 26, fontWeight: "800", color: "#fff", letterSpacing: -0.5, marginBottom: 6 },
  activatedAt: { fontSize: 13, color: "rgba(255,255,255,0.5)" },

  // Details card
  detailsCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1.5,
    borderColor: BORDER,
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 12, fontWeight: "700", letterSpacing: 1, color: GRAY, marginBottom: 14 },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F5F5F4",
  },
  detailLabel: { fontSize: 14, color: GRAY },
  detailValue: { fontSize: 14, fontWeight: "600", color: BLACK, maxWidth: "60%", textAlign: "right" },
  monoText: { fontFamily: "monospace", fontSize: 12 },

  // MoR card
  morCard: {
    backgroundColor: "#FFF7ED",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1.5,
    borderColor: "#FED7AA",
    marginBottom: 24,
  },
  morTitle: { fontSize: 14, fontWeight: "700", color: "#9A3412", marginBottom: 6 },
  morBody: { fontSize: 13, color: "#92400E", lineHeight: 20 },

  // Buttons
  manageBtn: {
    backgroundColor: BLACK,
    borderRadius: 100,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 12,
  },
  manageBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  cancelBtn: {
    borderRadius: 100,
    paddingVertical: 16,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: BORDER,
  },
  cancelBtnText: { color: GRAY, fontSize: 15, fontWeight: "600" },

  // Empty state
  emptyCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 32,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: BORDER,
    marginBottom: 24,
  },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: "800", color: BLACK, marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: GRAY, textAlign: "center", lineHeight: 20 },

  buyBtn: {
    backgroundColor: BLACK,
    borderRadius: 100,
    paddingVertical: 16,
    alignItems: "center",
  },
  buyBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
