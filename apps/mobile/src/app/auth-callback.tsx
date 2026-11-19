import { Redirect } from "expo-router";

/**
 * Landing spot for the Google sign-in redirect (mobileglam://auth-callback). The browser session normally
 * captures it first; if the OS opens the app with it instead, just send the user home: the route guards take over.
 */
export default function AuthCallback() {
  return <Redirect href="/" />;
}
