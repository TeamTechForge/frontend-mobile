import { GoogleAuthProvider, signInWithCredential } from "firebase/auth";
import { auth } from "../firebaseConfig";
import { API_URL } from "../constants/config.constants";
import { useState } from "react";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { Alert } from "react-native";

// ─── Types ────────────────────────────────────────────────────────────────────

type GoogleAuthResponseSuccess = {
  type: "success";
  params: { id_token: string };
};

type GoogleAuthResponseCancel = {
  type: "cancel" | "dismiss";
};

type GoogleAuthResponseError = {
  type: "error";
  error: string;
};

type GoogleAuthResponse =
  | GoogleAuthResponseSuccess
  | GoogleAuthResponseCancel
  | GoogleAuthResponseError
  | null;

type BackendAuthResponse = {
  success: boolean;
  token: string;
  user: object;
  isNewUser: boolean;
  message?: string;
};

// ─── Setup ────────────────────────────────────────────────────────────────────

// Detect if running inside the standard Expo Go client app
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

let GoogleSignin: any = null;
if (!isExpoGo) {
  // Only load the native library if running in a standalone/dev build
  GoogleSignin = require("@react-native-google-signin/google-signin").GoogleSignin;
  GoogleSignin.configure({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  });
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Custom hook that mimics expo-auth-session useAuthRequest.
 * It uses the native Google SDK under the hood but returns the same
 * { request, response, promptAsync, isReady } signature so our UI screens
 * don't need to change.
 */
export function useGoogleAuth() {
  const [response, setResponse] = useState<GoogleAuthResponse>(null);

  const promptAsync = async (): Promise<void> => {
    if (isExpoGo) {
      Alert.alert(
        "Google Sign-In Unavailable",
        "Google Sign-In requires a Development Build. Please log in with your Email & Password instead."
      );
      return;
    }

    try {
      setResponse(null); // Clear previous responses
      await GoogleSignin.hasPlayServices();

      // Clear previous Google session to force the account chooser popup
      try {
        await GoogleSignin.signOut();
      } catch {
        // Ignore if there was no active session
      }

      const userInfo = await GoogleSignin.signIn();
      const idToken: string | undefined = userInfo.idToken || userInfo.data?.idToken;

      if (!idToken) {
        throw new Error("Google Sign-In succeeded but no ID Token was received.");
      }

      setResponse({
        type: "success",
        params: { id_token: idToken },
      });
    } catch (error: any) {
      console.error("Native Google Sign-In error details:", error);

      // Match cancel code
      if (
        error.code === "SIGN_IN_CANCELLED" ||
        error.code === "12501" ||
        error.message?.includes("SIGN_IN_CANCELLED")
      ) {
        setResponse({ type: "cancel" });
      } else {
        setResponse({
          type: "error",
          error: error.message || "Native Google Sign-In failed",
        });
      }
    }
  };

  return {
    request: {}, // Mock request object to satisfy dependencies
    response,
    promptAsync,
    isReady: true,
    isExpoGo, // Export this flag so UI screens can dynamically adapt
  };
}

// ─── Functions ────────────────────────────────────────────────────────────────

/**
 * Complete the Google Sign-In flow after native Google SDK returns.
 *
 * Takes the mocked response from useGoogleAuth and runs the standard
 * Firebase login and Backend exchange.
 *
 * @param response - The response object from useGoogleAuth
 * @returns Promise resolving to { success, token, user, isNewUser }
 */
export async function handleGoogleSignIn(
  response: GoogleAuthResponse
): Promise<{ success: boolean; token: string; user: object; isNewUser: boolean }> {
  if (!response) {
    throw new Error("No response received from Google Sign-In.");
  }

  if (response.type === "dismiss" || response.type === "cancel") {
    throw new Error("CANCELLED");
  }

  if (response.type === "error") {
    throw new Error(response.error || "Google Sign-In failed.");
  }

  if (response.type !== "success") {
    throw new Error(
      `Google Sign-In failed with type: ${(response as any).type}. Please try again.`
    );
  }

  const { id_token } = response.params;

  if (!id_token) {
    throw new Error("Failed to obtain ID token from Google. Please try again.");
  }

  // Authenticate with Firebase using the Google credential
  let firebaseUser: ReturnType<typeof signInWithCredential> extends Promise<infer U>
    ? U extends { user: infer V }
      ? V
      : never
    : never;

  try {
    const credential = GoogleAuthProvider.credential(id_token);
    const userCredential = await signInWithCredential(auth, credential);
    firebaseUser = userCredential.user as any;
  } catch (error: any) {
    const message =
      error.code === "auth/invalid-credential"
        ? "Google credential is invalid or expired. Please try again."
        : error.code === "auth/network-request-failed"
          ? "Network error during authentication. Please check your connection."
          : `Firebase authentication failed: ${error.message}`;
    throw new Error(message);
  }

  // Get the Firebase ID token to send to the backend
  let firebaseIdToken: string;
  try {
    firebaseIdToken = await (firebaseUser as any).getIdToken();
  } catch {
    throw new Error("Failed to obtain Firebase ID token. Please try again.");
  }

  // Send the Firebase ID token to the backend
  let backendResponse: BackendAuthResponse;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const res = await fetch(`${API_URL}/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: firebaseIdToken }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    backendResponse = (await res.json()) as BackendAuthResponse;

    if (!res.ok) {
      throw new Error(backendResponse.message || "Backend authentication failed.");
    }
  } catch (error: any) {
    if (error.name === "AbortError") {
      throw new Error(
        "The server took too long to respond. Please check your connection and try again."
      );
    }
    if (error.message && !error.message.includes("fetch")) {
      throw error;
    }
    throw new Error(
      "Could not connect to the backend server. Please check your network connection."
    );
  }

  return {
    success: backendResponse.success,
    token: backendResponse.token,
    user: backendResponse.user,
    isNewUser: backendResponse.isNewUser,
  };
}

/**
 * Obtain a fresh Firebase ID token from a Google Sign-In response for
 * identity verification purposes (e.g. account deletion).
 *
 * Unlike handleGoogleSignIn, this function does NOT exchange the token with
 * the backend and does NOT return a StrayCare JWT. It only verifies the
 * Google credential with Firebase and returns the resulting Firebase ID token,
 * which the caller can send to a verification endpoint.
 *
 * @param response - The response object from useGoogleAuth
 * @returns A Firebase ID token string
 * @throws If the response is cancelled, invalid, or Firebase exchange fails
 */
export async function getFirebaseIdTokenForDeletion(
  response: GoogleAuthResponse
): Promise<string> {
  if (!response) {
    throw new Error("No response received from Google Sign-In.");
  }

  if (response.type === "dismiss" || response.type === "cancel") {
    throw new Error("CANCELLED");
  }

  if (response.type === "error") {
    throw new Error(response.error || "Google Sign-In failed.");
  }

  if (response.type !== "success") {
    throw new Error(
      `Google Sign-In failed with type: ${(response as any).type}. Please try again.`
    );
  }

  const { id_token } = response.params;

  if (!id_token) {
    throw new Error("Failed to obtain ID token from Google. Please try again.");
  }

  // Authenticate with Firebase using the Google credential to obtain a
  // Firebase ID token. We do not proceed to the StrayCare backend login flow.
  let firebaseUser: any;
  try {
    const credential = GoogleAuthProvider.credential(id_token);
    const userCredential = await signInWithCredential(auth, credential);
    firebaseUser = userCredential.user;
  } catch (error: any) {
    const message =
      error.code === "auth/invalid-credential"
        ? "Google credential is invalid or expired. Please try again."
        : error.code === "auth/network-request-failed"
          ? "Network error during authentication. Please check your connection."
          : `Firebase authentication failed: ${error.message}`;
    throw new Error(message);
  }

  // Exchange the Firebase user object for a short-lived Firebase ID token.
  try {
    return await firebaseUser.getIdToken();
  } catch {
    throw new Error("Failed to obtain Firebase ID token. Please try again.");
  }
}

/**
 * Clear the Google Sign-In session on the device.
 */
export async function clearGoogleSession(): Promise<void> {
  if (isExpoGo || !GoogleSignin) return;
  try {
    await GoogleSignin.signOut();
  } catch {
    // Ignore error if there was no active session
  }
}
