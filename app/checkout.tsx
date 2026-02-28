import { useMemo, useRef, useState } from "react";
import { ActivityIndicator, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Linking from "expo-linking";
import { WebView } from "react-native-webview";

export default function CheckoutScreen() {
  const router = useRouter();
  const { checkoutUrl, checkoutId } = useLocalSearchParams<{
    checkoutUrl?: string | string[];
    checkoutId?: string | string[];
  }>();
  const [loading, setLoading] = useState(true);
  const handledSuccess = useRef(false);

  const initialCheckoutId = useMemo(() => {
    if (!checkoutId) return undefined;
    const value = Array.isArray(checkoutId) ? checkoutId[0] : checkoutId;
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }, [checkoutId]);

  const initialUrl = useMemo(() => {
    if (!checkoutUrl || Array.isArray(checkoutUrl)) return "";
    try {
      return decodeURIComponent(checkoutUrl);
    } catch {
      return checkoutUrl;
    }
  }, [checkoutUrl]);

  function isPlaceholderId(value?: string) {
    if (!value) return true;
    return value.includes("CHECKOUT_ID") || /^\{.+\}$/.test(value);
  }

  function routeToSuccess(checkoutId?: string) {
    if (handledSuccess.current) return;
    handledSuccess.current = true;
    const resolvedCheckoutId = isPlaceholderId(checkoutId)
      ? initialCheckoutId
      : checkoutId;
    router.replace({
      pathname: "/success",
      params: resolvedCheckoutId ? { checkoutId: resolvedCheckoutId } : {},
    });
  }

  function maybeHandleSuccess(url: string): boolean {
    if (!url) return false;

    if (url.startsWith("creemapp://")) {
      const parsed = Linking.parse(url);
      if (parsed.path === "payment-success") {
        const checkoutId = parsed.queryParams?.checkout_id as string | undefined;
        routeToSuccess(checkoutId);
        return true;
      }
      return false;
    }

    try {
      const parsed = new URL(url);
      if (parsed.pathname === "/payment-success") {
        const checkoutId = parsed.searchParams.get("checkout_id") ?? undefined;
        routeToSuccess(checkoutId);
        return true;
      }
    } catch {
      return false;
    }

    return false;
  }

  if (!initialUrl) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.center}>
          <Text style={s.title}>Unable to open checkout</Text>
          <Text style={s.subtitle}>Checkout URL is missing. Go back and try again.</Text>
          <TouchableOpacity style={s.button} onPress={() => router.replace("/")}>
            <Text style={s.buttonText}>Back to plans</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={s.close}>Close</Text>
        </TouchableOpacity>
      </View>

      <View style={s.webViewWrap}>
        <WebView
          source={{ uri: initialUrl }}
          onLoadEnd={() => setLoading(false)}
          onNavigationStateChange={(navState) => {
            maybeHandleSuccess(navState.url);
          }}
          onShouldStartLoadWithRequest={(request) => !maybeHandleSuccess(request.url)}
          startInLoadingState
        />
      </View>

      {loading && (
        <View style={s.loaderOverlay}>
          <ActivityIndicator size="large" color="#0A0A0A" />
          <Text style={s.loaderText}>Loading checkout…</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#FAFAF8" },
  topBar: {
    height: 48,
    justifyContent: "center",
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5E3",
    backgroundColor: "#fff",
  },
  close: { color: "#0A0A0A", fontSize: 15, fontWeight: "600" },
  webViewWrap: { flex: 1, backgroundColor: "#fff" },
  loaderOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(250,250,248,0.95)",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loaderText: { color: "#0A0A0A", fontSize: 14, fontWeight: "600" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  title: { fontSize: 22, fontWeight: "700", color: "#0A0A0A", marginBottom: 10 },
  subtitle: { fontSize: 14, color: "#6B6B6B", textAlign: "center", marginBottom: 20 },
  button: {
    backgroundColor: "#0A0A0A",
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  buttonText: { color: "#fff", fontSize: 14, fontWeight: "700" },
});
