// app/_layout.tsx
import { useEffect } from "react";
import { Stack } from "expo-router";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";

export default function RootLayout() {
  const router = useRouter();

  useEffect(() => {
    // Handle deep links when app is already open (foreground)
    const subscription = Linking.addEventListener("url", ({ url }) => {
      handleDeepLink(url);
    });

    // Handle deep link that launched the app (cold start)
    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink(url);
    });

    return () => subscription.remove();
  }, []);

  function handleDeepLink(url: string) {
    // Expected: creemapp://payment-success?checkout_id=ch_xxx
    const parsed = Linking.parse(url);
    if (parsed.path === "payment-success") {
      const checkoutId = parsed.queryParams?.checkout_id as string | undefined;
      router.push({ pathname: "/success", params: { checkoutId } });
    }
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
        contentStyle: { backgroundColor: "#FAFAF8" },
      }}
    />
  );
}
