import Svg, { Path } from "react-native-svg";

/** The GlamDesk "G" with its gold sparkle (brand/logo-glyph.svg), drawn as vectors so it is crisp at any size. */
export function LogoGlyph({ size = 64, sparkle = true }: { size?: number; sparkle?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Path d="M42.4 24.6 A13.5 13.5 0 1 0 45.5 32.5 H33.5" fill="none" stroke="#fff" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
      {sparkle ? <Path d="M47.5 9 L49.4 14.6 L55 16.5 L49.4 18.4 L47.5 24 L45.6 18.4 L40 16.5 L45.6 14.6 Z" fill="#F7C948" /> : null}
    </Svg>
  );
}

/** Four-point sparkle used as decoration around the hero. */
export function Sparkle({ size = 16, color = "#F7C948" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16">
      <Path d="M8 0 L9.9 6.1 L16 8 L9.9 9.9 L8 16 L6.1 9.9 L0 8 L6.1 6.1 Z" fill={color} />
    </Svg>
  );
}

/** Google's multi-colour "G", per their sign-in button branding guidelines. */
export function GoogleG({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z" />
      <Path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <Path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <Path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z" />
    </Svg>
  );
}
