import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState, useEffect } from "react";
import { Alert, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import * as SecureStore from "expo-secure-store";
import { API_URL } from "../../constants/config.constants";

import SettingsRow from "../../components/settings/SettingsRow";
import BackButton from "../../components/BackButton";
import { useAuth } from "../../contexts/AuthContext";
import { pushNotificationService } from "../../services/pushNotificationService";
import { useGoogleAuth, getFirebaseIdTokenForDeletion } from "../../services/googleAuthService";

const BRAND_COLOR = "#F5A623";

export default function SettingsScreen() {
  const router = useRouter();
  const { logout, user } = useAuth();

  const [pushEnabled, setPushEnabled] = useState(true);

  // ── Modal state ──────────────────────────────────────────────────────────
  // Step 1: warning confirmation modal (both providers)
  const [warningModalVisible, setWarningModalVisible] = useState(false);
  // Step 2 (local only): password input modal
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  // Google re-auth hook — mirrored from Login.tsx
  const { response: googleResponse, promptAsync, isExpoGo } = useGoogleAuth();

  useEffect(() => {
    // Load saved preferences
    const loadPreferences = async () => {
      const savedPush = await SecureStore.getItemAsync("pushEnabled");
      if (savedPush !== null) {
        setPushEnabled(savedPush === "true");
      }
    };
    loadPreferences();
  }, []);

  // ── Google re-auth response handler ─────────────────────────────────────
  // Runs whenever the Google sign-in popup resolves (success, cancel, error).
  useEffect(() => {
    if (!googleResponse) return;

    const processGoogleDeletion = async () => {
      setIsDeletingAccount(true);
      try {
        // Obtain a Firebase ID token WITHOUT logging into the StrayCare backend.
        const firebaseIdToken = await getFirebaseIdTokenForDeletion(googleResponse);
        await performDeletion({ googleCredential: firebaseIdToken });
      } catch (error: any) {
        if (error.message === "CANCELLED") {
          // User dismissed the Google popup — do nothing
          return;
        }
        Alert.alert("Verification Failed", error.message || "Google authentication failed.");
      } finally {
        setIsDeletingAccount(false);
      }
    };

    processGoogleDeletion();
  }, [googleResponse]);

  const handlePushToggle = async (enabled: boolean) => {
    setPushEnabled(enabled);
    await SecureStore.setItemAsync("pushEnabled", enabled ? "true" : "false");

    if (enabled) {
      await pushNotificationService.initializePushNotifications();
    } else {
      await pushNotificationService.removeTokenFromBackend();
    }
  };

  // ── Step 1: open the warning modal ──────────────────────────────────────
  const handleDeleteAccountPress = () => {
    setWarningModalVisible(true);
  };

  // ── Step 2: user confirmed the warning — branch by provider ─────────────
  const handleWarningConfirm = () => {
    setWarningModalVisible(false);

    const isGoogleUser = user?.authProvider === "google";

    if (isGoogleUser) {
      // For Google users, trigger the native Google sign-in popup directly.
      // The useEffect above will handle the response.
      promptAsync();
    } else {
      // For email/password users, show the password input modal.
      setPassword("");
      setPasswordModalVisible(true);
    }
  };

  // ── Step 2b (local): user submitted their password ───────────────────────
  const handlePasswordConfirm = async () => {
    if (!password || password.trim() === "") {
      Alert.alert("Password required", "Please enter your current password to confirm deletion.");
      return;
    }
    setIsDeletingAccount(true);
    try {
      await performDeletion({ password });
    } finally {
      setIsDeletingAccount(false);
    }
  };

  // ── Core deletion call ───────────────────────────────────────────────────
  // Sends the DELETE /auth/me request with either { password } or { googleCredential }.
  const performDeletion = async (body: { password?: string; googleCredential?: string }) => {
    try {
      const token = await SecureStore.getItemAsync("authToken");
      if (!token) return;

      const response = await fetch(`${API_URL}/auth/me`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        // Clear local auth state and navigate to the confirmed deletion screen.
        await SecureStore.deleteItemAsync("authToken");
        setPasswordModalVisible(false);
        setWarningModalVisible(false);
        router.replace("/profile/AccountDeleted");
      } else {
        const errorData: any = await response.json();
        Alert.alert("Error", errorData.message || "Failed to delete account");
      }
    } catch (error) {
      console.error("Delete account error:", error);
      Alert.alert("Error", "An unexpected error occurred");
    }
  };

  const handleLogout = async () => {
    await logout();
    router.replace("/");
  };

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <BackButton onPress={() => router.back()} />
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <Text style={styles.sectionTitle}>ACCOUNT SETTINGS</Text>
      <View style={styles.card}>
        <SettingsRow
          icon="lock-closed-outline"
          title="Change Password"
          onPress={() => router.push("/profile/ResetPassword")}
        />
        <SettingsRow
          icon="shield-checkmark-outline"
          title="Privacy & Communication"
          onPress={() => router.push("/profile/PrivacySettings")}
        />
        <SettingsRow
          icon="globe-outline"
          title="Language"
          subtitle="English (US)"
          onPress={() => {
            // TODO: later open language selection
          }}
        />
      </View>

      <Text style={styles.sectionTitle}>APP PREFERENCES</Text>
      <View style={styles.card}>
        <SettingsRow
          icon="send-outline"
          title="Enable Push Notifications"
          showSwitch
          switchValue={pushEnabled}
          onSwitchChange={handlePushToggle}
        />
      </View>

      <Text style={styles.sectionTitle}>SUPPORT & INFORMATION</Text>
      <View style={styles.card}>
        <SettingsRow
          icon="help-circle-outline"
          title="Help & Support"
          onPress={() => router.push("/profile/HelpSupport")}
        />
        <SettingsRow
          icon="document-text-outline"
          title="Terms & Privacy Policy"
          onPress={() => router.push("/auth/TermsPrivacyScreen")}
        />
        <SettingsRow
          icon="information-circle-outline"
          title="About StrayCare"
          onPress={() => router.push("/profile/About")}
        />
      </View>

      <TouchableOpacity
        style={styles.deleteTextButton}
        onPress={handleDeleteAccountPress}
      >
        <Ionicons name="trash-outline" size={15} color="#FF5A5A" />
        <Text style={styles.deleteText}>Delete Account</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={18} color="#F04444" />
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>

      <Text style={styles.version}>v2.4.0{"\n"}STRAYCARE RESCUE FOUNDATION</Text>

      {/* ── STEP 1: WARNING MODAL (both providers) ── */}
      <Modal visible={warningModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.warningCircle}>
              <Ionicons name="warning-outline" size={30} color={BRAND_COLOR} />
            </View>

            <Text style={styles.modalTitle}>Delete Account?</Text>

            <Text style={styles.modalText}>
              Are you sure you want to delete your StrayCare account? This
              action is permanent. You will lose all saved stray profiles,
              donation history, and preferences immediately.
            </Text>

            <TouchableOpacity
              style={[styles.deleteButton, isDeletingAccount && { opacity: 0.6 }]}
              onPress={handleWarningConfirm}
              disabled={isDeletingAccount}
            >
              <Text style={styles.deleteButtonText}>
                {user?.authProvider === "google"
                  ? "Continue — Verify with Google"
                  : "Continue — Enter Password"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setWarningModalVisible(false)} disabled={isDeletingAccount}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── STEP 2: PASSWORD MODAL (local/email users only) ── */}
      <Modal visible={passwordModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.warningCircle}>
              <Ionicons name="lock-closed-outline" size={26} color={BRAND_COLOR} />
            </View>

            <Text style={styles.modalTitle}>Confirm Deletion</Text>

            <Text style={styles.modalText}>
              Enter your current password to permanently delete your account.
            </Text>

            <View style={styles.passwordRow}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Current password"
                placeholderTextColor="#999"
                secureTextEntry={!passwordVisible}
                value={password}
                onChangeText={setPassword}
                autoCapitalize="none"
                editable={!isDeletingAccount}
              />
              <TouchableOpacity
                onPress={() => setPasswordVisible((v) => !v)}
                style={styles.eyeButton}
              >
                <Ionicons
                  name={passwordVisible ? "eye-off-outline" : "eye-outline"}
                  size={20}
                  color="#888"
                />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.deleteButton, isDeletingAccount && { opacity: 0.6 }]}
              onPress={handlePasswordConfirm}
              disabled={isDeletingAccount}
            >
              <Text style={styles.deleteButtonText}>
                {isDeletingAccount ? "Deleting…" : "Delete Permanently"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setPasswordModalVisible(false);
                setPassword("");
              }}
              disabled={isDeletingAccount}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 18,
    backgroundColor: "#FAFAFA",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  sectionTitle: {
    fontSize: 11,
    color: BRAND_COLOR,
    fontWeight: "700",
    letterSpacing: 1,
    marginTop: 16,
    marginBottom: 8,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  deleteTextButton: {
    marginTop: 28,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  deleteText: {
    color: "#FF5A5A",
    fontSize: 13,
    fontWeight: "600",
  },
  logoutButton: {
    marginTop: 34,
    borderWidth: 1,
    borderColor: "#FFD6D6",
    backgroundColor: "#FFF2F2",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  logoutText: {
    color: "#F04444",
    fontWeight: "700",
  },
  version: {
    textAlign: "center",
    marginTop: 28,
    color: "#BBB",
    fontSize: 10,
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: 28,
  },
  modalCard: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 24,
    alignItems: "center",
  },
  warningCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#FFF4E5",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 12,
  },
  modalText: {
    textAlign: "center",
    color: "#666",
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 22,
  },
  deleteButton: {
    width: "100%",
    backgroundColor: "#F04444",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 14,
  },
  deleteButtonText: {
    color: "#fff",
    fontWeight: "800",
  },
  cancelText: {
    fontWeight: "700",
    color: "#333",
  },
  // ── Password input row inside the deletion confirmation modal ──
  passwordRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    backgroundColor: "#F9FAFB",
    marginBottom: 20,
  },
  passwordInput: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    color: "#111",
  },
  eyeButton: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
});