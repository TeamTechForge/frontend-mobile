import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import * as SecureStore from "expo-secure-store";
import { API_URL } from "../../constants/config.constants";
import InputField from "../../components/InputField";
import PrimaryButton from "../../components/PrimaryButton";
import BackButton from "../../components/BackButton";

const BRAND_COLOR = "#F5A623";

export default function ResetPasswordScreen() {
  const router = useRouter();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [errors, setErrors] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const validate = () => {
    let valid = true;

    const newErrors = {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    };

    if (!currentPassword.trim()) {
      newErrors.currentPassword = "Current password is required";
      valid = false;
    }

    if (!newPassword.trim()) {
      newErrors.newPassword = "New password is required";
      valid = false;
    } else if (!/^(?=.*[A-Z])(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,15}$/.test(newPassword)) {
      newErrors.newPassword = "Must be 8-15 chars, with at least 1 uppercase and 1 symbol";
      valid = false;
    }

    if (!confirmPassword.trim()) {
      newErrors.confirmPassword = "Please confirm your new password";
      valid = false;
    } else if (newPassword !== confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
      valid = false;
    }

    setErrors(newErrors);
    return valid;
  };

  const handleUpdatePassword = async () => {
    if (!validate()) return;

    try {
      const token = await SecureStore.getItemAsync("authToken");
      if (!token) {
        Alert.alert("Error", "You must be logged in to change your password.");
        return;
      }

      const response = await fetch(`${API_URL}/auth/change-password`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          currentPassword,
          newPassword: newPassword.trim(),
        }),
      });

      const data: any = await response.json();

      if (response.ok) {
        Alert.alert("Success", "Password updated successfully", [
          { text: "OK", onPress: () => router.back() }
        ]);
      } else {
        if (data.message === "Incorrect current password") {
          setErrors((prev) => ({ ...prev, currentPassword: "The password you entered is incorrect" }));
        } else {
          Alert.alert("Error", data.message || "Failed to update password");
        }
      }
    } catch (error) {
      console.error("Password update error:", error);
      Alert.alert("Error", "An unexpected error occurred. Please try again.");
    }
  };

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <BackButton onPress={() => router.back()} />
        <Text style={styles.headerTitle}>Change Password</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.iconCircle}>
        <Ionicons name="lock-closed-outline" size={28} color={BRAND_COLOR} />
      </View>

      <Text style={styles.title}>New Credentials</Text>
      <Text style={styles.subtitle}>
        Create a secure new password for your account to get back to helping pets.
      </Text>

      <Text style={styles.label}>Current Password</Text>
      <InputField
        placeholder="Your current password"
        value={currentPassword}
        onChangeText={setCurrentPassword}
        secure
        error={errors.currentPassword}
      />

      <Text style={styles.label}>New Password</Text>
      <InputField
        placeholder="At least 6 characters"
        value={newPassword}
        onChangeText={setNewPassword}
        secure
        error={errors.newPassword}
      />

      <Text style={styles.helper}>ⓘ Minimum 6 characters.</Text>

      <Text style={styles.label}>Confirm New Password</Text>
      <InputField
        placeholder="Re-type your password"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secure
        error={errors.confirmPassword}
      />

      <View style={{ marginTop: 18 }}>
        <PrimaryButton title="Update Password" onPress={handleUpdatePassword} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#FAFAFA",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 36,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  iconCircle: {
    alignSelf: "center",
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#FFF4E5",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 22,
  },
  title: {
    textAlign: "center",
    fontSize: 26,
    fontWeight: "800",
    marginBottom: 10,
  },
  subtitle: {
    textAlign: "center",
    color: "#666",
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 28,
  },
  helper: {
    color: "#777",
    fontSize: 11,
    marginTop: -2,
    marginBottom: 8,
  },
  label: {
    fontSize: 13,
    marginBottom: 6,
    fontWeight: "500",
    color: "#333",
  },
});