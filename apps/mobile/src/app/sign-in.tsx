import { detectUgNetwork, normalizeUgPhone, type UgNetwork } from "@mobileglam/shared";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState, type ReactNode } from "react";
import {
  ActivityIndicator, Animated, Easing, Keyboard, KeyboardAvoidingView, LayoutAnimation, Platform, Pressable, StyleSheet, Text, TextInput, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GoogleG, LogoGlyph, Sparkle } from "@/components/brand";
import { colors } from "@/components/ui";
import { AuthCancelled, appleSignInAvailable, signInWithApple, signInWithGoogle } from "@/lib/social-auth";
import { supabase } from "@/lib/supabase";

const RESEND_SECONDS = 45;
const GOLD = "#F7C948";
const PILLS = ["💇🏾‍♀️ Braids", "💈 Fades", "💅🏾 Nails", "✨ Makeup", "🌿 Hair clinics", "🏠 Home visits"];
const NETWORK: Partial<Record<UgNetwork, { label: string; bg: string; fg: string }>> = {
  mtn: { label: "MTN", bg: "#FFCB05", fg: "#1E1B24" },
  airtel: { label: "Airtel", bg: "#E40000", fg: "#fff" },
};

type Step = "choose" | "phone" | "code";
type Busy = null | "apple" | "google" | "send" | "verify";

/** Landing + sign-in: Apple, Google, or phone number with an SMS code. */
export default function SignIn() {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>("choose");
  const [phoneInput, setPhoneInput] = useState("");
  const [phone, setPhone] = useState<string | null>(null); // E.164, set once the code was requested
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [appleOk, setAppleOk] = useState(false);
  const keyboardUp = useKeyboardVisible();

  useEffect(() => { void appleSignInAvailable().then(setAppleOk); }, []);
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // ---- entrance animation: logo pops, text rises, pills ripple in, sheet slides up ----
  const intro = useState(() => new Animated.Value(0))[0];
  const sheet = useState(() => new Animated.Value(0))[0];
  const pills = useState(() => PILLS.map(() => new Animated.Value(0)))[0];
  useEffect(() => {
    Animated.parallel([
      Animated.spring(intro, { toValue: 1, friction: 6, tension: 60, useNativeDriver: true }),
      Animated.spring(sheet, { toValue: 1, delay: 250, friction: 9, tension: 50, useNativeDriver: true }),
      Animated.stagger(70, pills.map((p) => Animated.timing(p, { toValue: 1, duration: 380, delay: 350, easing: Easing.out(Easing.back(1.6)), useNativeDriver: true }))),
    ]).start();
  }, [intro, sheet, pills]);

  const go = (next: Step) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setError(null);
    setStep(next);
  };

  async function social(kind: "apple" | "google", run: () => Promise<void>) {
    void Haptics.selectionAsync();
    setBusy(kind); setError(null);
    try {
      await run();
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // The route guard in _layout swaps to the app as soon as the session lands.
    } catch (e) {
      if (!(e instanceof AuthCancelled)) setError(e instanceof Error ? e.message : "Sign-in failed. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  async function sendCode() {
    const e164 = normalizeUgPhone(phoneInput);
    if (!e164) return setError("Enter a valid Ugandan mobile number, e.g. 772 123 456");
    setBusy("send"); setError(null);
    const { error } = await supabase.auth.signInWithOtp({ phone: e164 });
    setBusy(null);
    if (error) {
      const offline = error.name === "AuthRetryableFetchError" || /network|fetch/i.test(error.message);
      const msg = /rate|too many/i.test(error.message) ? "Too many attempts. Please wait a minute."
        : offline ? "Couldn't send the code. Check your connection and try again."
        : "We couldn't text a code to this number right now. Please try again shortly.";
      // In development, surface Supabase's own reason (e.g. SMS provider/hook not configured).
      return setError(__DEV__ ? `${msg}\n(${error.message})` : msg);
    }
    void Haptics.selectionAsync();
    setPhone(e164); setCode(""); setCooldown(RESEND_SECONDS);
    if (step !== "code") go("code");
  }

  async function verify(token: string) {
    if (!phone) return;
    setBusy("verify"); setError(null);
    const { error } = await supabase.auth.verifyOtp({ phone, token, type: "sms" });
    setBusy(null);
    if (error) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError("That code is incorrect or has expired.");
      setCode("");
    } else {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }

  // Submit as soon as the 6th digit is typed (or autofilled from the SMS).
  function onCode(t: string) {
    setCode(t); setError(null);
    if (t.length === 6 && !busy) void verify(t);
  }

  const carrier = detectUgNetwork(phoneInput);
  const network = carrier ? NETWORK[carrier] : undefined;
  const compactHero = keyboardUp || step !== "choose";

  return (
    <View style={{ flex: 1, backgroundColor: "#2A1146" }}>
      <StatusBar style="light" />
      <LinearGradient colors={["#2A1146", "#4A2273", "#6E35A3"]} locations={[0, 0.55, 1]} style={StyleSheet.absoluteFill} />
      <Blob size={320} color="#8E4CC9" style={{ top: -90, left: -110 }} period={5200} />
      <Blob size={240} color={GOLD} opacity={0.14} style={{ top: 140, right: -100 }} period={6400} />
      <Blob size={200} color="#C084FC" opacity={0.18} style={{ top: 380, left: -60 }} period={4600} />

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, paddingTop: insets.top }}>
        {/* ---------- hero ---------- */}
        <View style={s.hero}>
          <Animated.View style={{ opacity: intro, transform: [{ scale: intro.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] }}>
            <View style={[s.logoTile, compactHero && s.logoTileSmall]}>
              <LogoGlyph size={compactHero ? 44 : 68} />
            </View>
            <Twinkle style={{ position: "absolute", top: -14, right: -18 }} size={14} delay={0} />
            <Twinkle style={{ position: "absolute", bottom: 4, left: -22 }} size={10} delay={700} />
          </Animated.View>

          <Animated.View style={{ alignItems: "center", opacity: intro, transform: [{ translateY: intro.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }}>
            <Text style={[s.brand, compactHero && { fontSize: 26, marginTop: 10 }]}>Mobile<Text style={{ color: GOLD }}>Glam</Text></Text>
            {!compactHero ? <Text style={s.tagline}>Look good. Book in seconds.</Text> : null}
          </Animated.View>

          {!compactHero ? (
            <View style={s.pills}>
              {PILLS.map((p, i) => (
                <Animated.View key={p} style={{ opacity: pills[i], transform: [{ scale: pills[i]!.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }] }}>
                  <View style={s.pill}><Text style={s.pillText}>{p}</Text></View>
                </Animated.View>
              ))}
            </View>
          ) : null}
        </View>

        {/* ---------- bottom sheet ---------- */}
        <Animated.View style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 8, transform: [{ translateY: sheet.interpolate({ inputRange: [0, 1], outputRange: [420, 0] }) }] }]}>
          <View style={s.grabber} />

          {step === "choose" ? (
            <View>
              <Text style={s.title}>Get started</Text>
              <Text style={s.subtitle}>Salons, barbers and hair clinics near you. Sign in or create an account in seconds.</Text>

              {appleOk ? (
                <View pointerEvents={busy ? "none" : "auto"} style={{ opacity: busy && busy !== "apple" ? 0.5 : 1 }}>
                  <AppleAuthentication.AppleAuthenticationButton
                    buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                    buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                    cornerRadius={14}
                    style={{ height: 52, width: "100%" }}
                    onPress={() => void social("apple", signInWithApple)}
                  />
                </View>
              ) : null}

              <AuthButton
                onPress={() => void social("google", signInWithGoogle)} loading={busy === "google"} disabled={!!busy}
                icon={<GoogleG size={20} />} label="Continue with Google" style={[s.outlineBtn, appleOk && { marginTop: 12 }]} textStyle={{ color: colors.text }}
              />

              <View style={s.divider}>
                <View style={s.rule} /><Text style={s.dividerText}>or</Text><View style={s.rule} />
              </View>

              <AuthButton
                onPress={() => go("phone")} disabled={!!busy}
                icon={<Text style={{ fontSize: 18 }}>📱</Text>} label="Continue with phone number" style={s.primaryBtn} textStyle={{ color: "#fff" }}
              />

              <Text style={s.legal}>By continuing you agree to MobileGlam’s Terms of Service and Privacy Policy.</Text>
            </View>
          ) : step === "phone" ? (
            <View>
              <BackLink onPress={() => go("choose")} />
              <Text style={s.title}>What’s your number?</Text>
              <Text style={s.subtitle}>We’ll text you a 6-digit code to confirm it’s you.</Text>
              <View style={s.phoneRow}>
                <View style={s.prefix}><Text style={{ fontSize: 18 }}>🇺🇬</Text><Text style={s.prefixText}>+256</Text></View>
                <TextInput
                  style={s.phoneInput} value={phoneInput} onChangeText={(t) => { setPhoneInput(t); setError(null); }}
                  placeholder="772 123 456" placeholderTextColor="#A39DAE" autoFocus
                  keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" maxLength={16}
                  returnKeyType="done" onSubmitEditing={() => void sendCode()}
                />
                {network ? <View style={[s.network, { backgroundColor: network.bg }]}><Text style={[s.networkText, { color: network.fg }]}>{network.label}</Text></View> : null}
              </View>
              <AuthButton
                onPress={() => void sendCode()} loading={busy === "send"} disabled={!!busy || !normalizeUgPhone(phoneInput)}
                label="Send code" style={[s.primaryBtn, { marginTop: 16 }]} textStyle={{ color: "#fff" }}
              />
            </View>
          ) : (
            <View>
              <BackLink onPress={() => go("phone")} label="Change number" />
              <Text style={s.title}>Enter your code</Text>
              <Text style={s.subtitle}>Sent by SMS to <Text style={{ fontWeight: "700", color: colors.text }}>{formatPhone(phone)}</Text></Text>
              <CodeBoxes value={code} onChange={onCode} />
              {busy === "verify" ? <ActivityIndicator color={colors.primary} style={{ marginTop: 16 }} /> : null}
              <Pressable
                accessibilityRole="button" onPress={() => void sendCode()} disabled={cooldown > 0 || !!busy} hitSlop={8}
                style={{ alignSelf: "center", marginTop: 18, opacity: cooldown > 0 ? 0.55 : 1 }}
              >
                <Text style={{ color: colors.primary, fontWeight: "700" }}>{cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}</Text>
              </Pressable>
            </View>
          )}

          {error ? <Text style={s.error} accessibilityLiveRegion="polite">{error}</Text> : null}
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

// ---------------------------------------------------------------- pieces

function AuthButton({ label, icon, onPress, loading, disabled, style, textStyle }: {
  label: string; icon?: ReactNode; onPress: () => void; loading?: boolean; disabled?: boolean;
  style?: object | (object | false)[]; textStyle?: object;
}) {
  const scale = useState(() => new Animated.Value(1))[0];
  const to = (v: number) => Animated.spring(scale, { toValue: v, friction: 5, tension: 300, useNativeDriver: true }).start();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} disabled={disabled || loading} onPressIn={() => to(0.97)} onPressOut={() => to(1)}>
      <Animated.View style={[s.btn, style, (disabled || loading) && { opacity: loading ? 0.85 : 0.5 }, { transform: [{ scale }] }]}>
        {loading ? <ActivityIndicator color={(textStyle as { color?: string })?.color ?? "#fff"} /> : (
          <>
            {icon ? <View style={{ width: 22, alignItems: "center" }}>{icon}</View> : null}
            <Text style={[s.btnText, textStyle]}>{label}</Text>
          </>
        )}
      </Animated.View>
    </Pressable>
  );
}

function BackLink({ onPress, label = "Back" }: { onPress: () => void; label?: string }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={10} style={{ alignSelf: "flex-start", marginBottom: 8 }}>
      <Text style={{ color: colors.primary, fontWeight: "700" }}>‹ {label}</Text>
    </Pressable>
  );
}

/** Six boxes over one invisible input, so SMS autofill and paste still work. */
function CodeBoxes({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [focused, setFocused] = useState(true);
  return (
    <View style={{ marginTop: 18 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        {Array.from({ length: 6 }, (_, i) => {
          const active = focused && i === Math.min(value.length, 5);
          return (
            <View key={i} style={[s.box, !!value[i] && s.boxFilled, active && s.boxActive]}>
              <Text style={s.boxText}>{value[i] ?? ""}</Text>
            </View>
          );
        })}
      </View>
      <TextInput
        value={value} onChangeText={(t) => onChange(t.replace(/\D/g, "").slice(0, 6))}
        keyboardType="number-pad" maxLength={6} autoComplete="sms-otp" textContentType="oneTimeCode" autoFocus caretHidden
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        accessibilityLabel="6-digit code" style={[StyleSheet.absoluteFill, { opacity: 0.02, color: "transparent" }]}
      />
    </View>
  );
}

/** Soft glowing orb that slowly breathes behind the hero. */
function Blob({ size, color, opacity = 0.35, style, period }: { size: number; color: string; opacity?: number; style: object; period: number }) {
  const v = useState(() => new Animated.Value(0))[0];
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: period, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(v, { toValue: 0, duration: period, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [v, period]);
  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: "absolute", width: size, height: size, borderRadius: size / 2, backgroundColor: color, opacity }, style,
        { transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] }) }, { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, 18] }) }] }]}
    />
  );
}

/** Gold sparkle that fades and spins gently, echoing the one in the logo. */
function Twinkle({ style, size, delay }: { style: object; size: number; delay: number }) {
  const v = useState(() => new Animated.Value(0))[0];
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.delay(delay),
      Animated.timing(v, { toValue: 1, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(v, { toValue: 0, duration: 900, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      Animated.delay(1400 - delay),
    ]));
    loop.start();
    return () => loop.stop();
  }, [v, delay]);
  return (
    <Animated.View pointerEvents="none" style={[style, { opacity: v, transform: [{ scale: v }, { rotate: v.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "90deg"] }) }] }]}>
      <Sparkle size={size} />
    </Animated.View>
  );
}

function useKeyboardVisible() {
  const [up, setUp] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", () => setUp(true));
    const hide = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () => setUp(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  return up;
}

const formatPhone = (e164: string | null) => (e164 ? e164.replace(/^\+256(\d{3})(\d{3})(\d{3})$/, "+256 $1 $2 $3") : "");

const s = StyleSheet.create({
  hero: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24, paddingVertical: 12 },
  logoTile: {
    width: 108, height: 108, borderRadius: 32, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)", borderWidth: 1, borderColor: "rgba(255,255,255,0.28)",
    shadowColor: GOLD, shadowOpacity: 0.35, shadowRadius: 24, shadowOffset: { width: 0, height: 0 },
  },
  logoTileSmall: { width: 72, height: 72, borderRadius: 22 },
  brand: { color: "#fff", fontSize: 40, fontWeight: "800", letterSpacing: -0.5, marginTop: 18 },
  tagline: { color: "rgba(255,255,255,0.82)", fontSize: 17, marginTop: 6, fontWeight: "500" },
  pills: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8, marginTop: 26, maxWidth: 360 },
  pill: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.12)", borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" },
  pillText: { color: "#fff", fontWeight: "600", fontSize: 13.5 },

  sheet: {
    backgroundColor: colors.card, borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: 22, paddingTop: 10,
    shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 24, shadowOffset: { width: 0, height: -6 }, elevation: 16,
  },
  grabber: { alignSelf: "center", width: 40, height: 5, borderRadius: 3, backgroundColor: colors.border, marginBottom: 14 },
  title: { fontSize: 24, fontWeight: "800", color: colors.text, letterSpacing: -0.3 },
  subtitle: { color: colors.muted, fontSize: 15, marginTop: 4, marginBottom: 20, lineHeight: 21 },

  btn: { minHeight: 52, borderRadius: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingHorizontal: 16 },
  btnText: { fontSize: 17, fontWeight: "600" },
  primaryBtn: { backgroundColor: colors.primary },
  outlineBtn: { backgroundColor: "#fff", borderWidth: 1.5, borderColor: colors.border },

  divider: { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 16 },
  rule: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: "#CFC7DA" },
  dividerText: { color: colors.muted, fontSize: 13, fontWeight: "600" },
  legal: { color: colors.muted, fontSize: 12, textAlign: "center", marginTop: 16, lineHeight: 17 },

  phoneRow: { flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderColor: colors.border, borderRadius: 14, backgroundColor: "#fff", paddingRight: 10 },
  prefix: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 14, borderRightWidth: 1, borderRightColor: colors.border },
  prefixText: { fontSize: 17, fontWeight: "600", color: colors.text },
  phoneInput: { flex: 1, fontSize: 18, paddingHorizontal: 12, paddingVertical: 14, color: colors.text, letterSpacing: 0.5 },
  network: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  networkText: { fontSize: 12, fontWeight: "800" },

  box: { width: 48, height: 58, borderRadius: 14, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" },
  boxFilled: { borderColor: "#B79AD6", backgroundColor: colors.primarySoft },
  boxActive: { borderColor: colors.primary, borderWidth: 2, backgroundColor: "#fff" },
  boxText: { fontSize: 24, fontWeight: "700", color: colors.text },

  error: { color: colors.danger, marginTop: 14, textAlign: "center", fontWeight: "500" },
});
