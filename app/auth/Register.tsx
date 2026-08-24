import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useGoogleAuth, handleGoogleSignIn } from "../../services/googleAuthService";

import InputField from "../../components/InputField";
import PrimaryButton from "../../components/PrimaryButton";
import { API_URL } from "../../constants/config.constants";
import { useAuth } from "../../contexts/AuthContext";
import CustomAlertModal from "../../components/CustomAlertModal";
import { setStoredItem } from "../../utils/storage";

const BRAND_COLOR = "#F5A623";

/* Handles registration by collecting user details, validating input, 
and registering the user with the backend.*/
export default function RegisterScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { refreshUser } = useAuth();

  const [agree, setAgree] = useState(params.agreed === "true");

  const [name, setName] = useState(params.name ? (params.name as string) : "");
  const [email, setEmail] = useState(params.email ? (params.email as string) : "");
  const [phone, setPhone] = useState(params.phone ? (params.phone as string) : "");
  const [password, setPassword] = useState(params.password ? (params.password as string) : "");
  const [confirmPassword, setConfirmPassword] = useState(params.confirmPassword ? (params.confirmPassword as string) : "");

  const [errors, setErrors] = useState<any>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isAccountExistsVisible, setIsAccountExistsVisible] = useState(false);

  // Google Sign-In setup
  const { response: googleResponse, promptAsync, isReady: isGoogleReady, isExpoGo } = useGoogleAuth();

  // Handle Google Sign-In response
  useEffect(() => {
    if (!googleResponse) return;

    const processGoogleSignIn = async () => {
      setIsGoogleLoading(true);
      try {
        const result = await handleGoogleSignIn(googleResponse);
        await setStoredItem("authToken", result.token);
        await refreshUser();

        if (result.isNewUser) {
          // New Google account — needs role selection
          router.replace("/auth/RoleSelection");
        } else {
          // Existing account — go straight to home
          router.replace("/(tabs)/Home");
        }
      } catch (error: any) {
        if (error.message === "CANCELLED") {
          return;
        }
        console.error("Google Sign-In error:", error);
        Alert.alert("Google Sign-In Failed", error.message);
      } finally {
        setIsGoogleLoading(false);
      }
    };

    processGoogleSignIn();
  }, [googleResponse]);

  // Validates registration input
  const validateForm = () => {
    let newErrors: any = {};

    if (!name.trim()) newErrors.name = "Name is required";

    if (!email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = "Invalid email";
    }

    if (!phone.trim()) {
      newErrors.phone = "Phone is required";
    } else if (!/^[0-9]{10}$/.test(phone.trim())) {
      newErrors.phone = "Must be exactly 10 digits (e.g. 0771234567)";
    }

    if (!password) {
      newErrors.password = "Password is required";
    } else if (!/^(?=.*[A-Z])(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,15}$/.test(password)) {
      newErrors.password = "Must be 8-15 chars, with at least 1 uppercase and 1 symbol";
    }

    if (confirmPassword !== password) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    if (!agree) {
      newErrors.terms = "You must accept terms";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Registers a valid user
  const handleRegister = async () => {
    if (!validateForm()) return;
    setIsLoading(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      console.log("Attempting registration via:", `${API_URL}/auth/Register`);
      const response = await fetch(
        `${API_URL}/auth/Register`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name,
            email,
            phone,
            password,
          }),
          signal: controller.signal as any,
        }
      );

      clearTimeout(timeoutId);

      let data: any = {};
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        try {
          data = await response.json();
        } catch (jsonErr) {
          console.error("Failed to parse JSON response:", jsonErr);
        }
      } else {
        const text = await response.text();
        data = { message: `Server error (${response.status}): ${text || response.statusText}` };
      }

      console.log("Registration response:", data);

      if (response.ok) {
        // Store JWT securely
        await setStoredItem("authToken", data.token);

        // Refresh AuthContext so token + user are available app-wide
        await refreshUser();

        router.replace("/auth/RoleSelection");
      } else {
        const errMsg = data.message || (data.error ? String(data.error) : "Registration failed");
        console.log("[Register] Response status:", response.status);
        console.log("[Register] Error message:", errMsg);
        if (errMsg.includes("already registered") || errMsg.includes("already exists") || errMsg.includes("already exist")) {
          console.log("[Register] Showing account exists popup");
          setIsAccountExistsVisible(true);
        } else {
          Alert.alert("Registration Failed", errMsg);
        }
      }
    } catch (error: any) {
      clearTimeout(timeoutId);
      console.error("Registration error:", error);
      if (error.name === "AbortError") {
        Alert.alert(
          "Request Timed Out",
          "The server took too long to respond. Please check your connection and try again."
        );
      } else {
        Alert.alert(
          "Connection Error",
          "Could not connect to the backend server. Please check your network connection and verify the API endpoint."
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Image
          source={require("../../assets/images/signupimg.jpg")}
          style={styles.topImage}
        />

        <View style={styles.card}>
          <Text style={styles.title}>Create your StrayCare account</Text>

          <Text style={styles.subtitle}>
            Join our community and help save lives
          </Text>

          <Text style={styles.label}>
            Name <Text style={{ color: "red" }}>*</Text>
          </Text>
          <InputField
            placeholder="Kasun Perera"
            value={name}
            onChangeText={setName}
            editable={!isLoading}
          />
          {errors.name && <Text style={styles.error}>{errors.name}</Text>}

          <Text style={styles.label}>
            Email Address <Text style={{ color: "red" }}>*</Text>
          </Text>
          <InputField
            placeholder="Kasunperera@gmail.com"
            value={email}
            onChangeText={setEmail}
            editable={!isLoading}
          />
          {errors.email && <Text style={styles.error}>{errors.email}</Text>}

          <Text style={styles.label}>
            Phone Number <Text style={{ color: "red" }}>*</Text>
          </Text>
          <InputField
            placeholder="e.g. 0771234567"
            value={phone}
            onChangeText={setPhone}
            editable={!isLoading}
          />
          {errors.phone && <Text style={styles.error}>{errors.phone}</Text>}

          <Text style={styles.label}>
            Password <Text style={{ color: "red" }}>*</Text>
          </Text>
          <InputField
            placeholder="********"
            value={password}
            onChangeText={setPassword}
            secure
            editable={!isLoading}
          />
          {errors.password && <Text style={styles.error}>{errors.password}</Text>}

          <Text style={styles.label}>
            Confirm Password <Text style={{ color: "red" }}>*</Text>
          </Text>
          <InputField
            placeholder="********"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secure
            editable={!isLoading}
          />
          {errors.confirmPassword && (
            <Text style={styles.error}>{errors.confirmPassword}</Text>
          )}

          <TouchableOpacity
            style={styles.termsContainer}
            onPress={() => setAgree(!agree)}
            disabled={isLoading}
          >
            <Ionicons
              name={agree ? "checkbox" : "square-outline"}
              size={20}
              color={agree ? BRAND_COLOR : "#999"}
            />
            <Text style={styles.termsText}>
              I agree to the{" "}
              <Text
                style={{ color: BRAND_COLOR }}
                onPress={() =>
                  router.push({
                    pathname: "/auth/TermsPrivacyScreen",
                    params: { name, email, phone, password, confirmPassword }
                  })
                }
              >
                Terms & Privacy Policy
              </Text>
            </Text>
          </TouchableOpacity>

          {errors.terms && <Text style={styles.error}>{errors.terms}</Text>}

          <PrimaryButton
            title={isLoading ? "Creating Account..." : "Create Account"}
            onPress={handleRegister}
            disabled={isLoading}
          />

          <View style={styles.dividerContainer}>
            <View style={styles.line} />
            <Text style={styles.orText}>OR</Text>
            <View style={styles.line} />
          </View>

          {!isExpoGo && (
            <TouchableOpacity
              style={[styles.googleButton, (isLoading || isGoogleLoading || !isGoogleReady) && { opacity: 0.6 }]}
              onPress={() => promptAsync()}
              disabled={isLoading || isGoogleLoading || !isGoogleReady}
            >
              {isGoogleLoading ? (
                <ActivityIndicator size="small" color="#DB4437" style={{ marginRight: 8 }} />
              ) : (
                <MaterialCommunityIcons
                  name="google"
                  size={18}
                  color="#DB4437"
                  style={{ marginRight: 8 }}
                />
              )}
              <Text style={styles.googleText}>
                {isGoogleLoading ? "Signing in..." : "Continue with Google"}
              </Text>
            </TouchableOpacity>
          )}

          <View style={styles.loginContainer}>
            <Text style={{ fontSize: 13 }}>Already have an account?</Text>
            <TouchableOpacity onPress={() => router.push("/auth/Login")} disabled={isLoading}>
              <Text style={styles.loginText}> Log in</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <CustomAlertModal
        visible={isAccountExistsVisible}
        title="Account Already Exists"
        message="This email is already registered. Please log in instead."
        confirmLabel="Go to Login"
        cancelLabel="Cancel"
        onConfirm={() => {
          setIsAccountExistsVisible(false);
          router.push("/auth/Login");
        }}
        onCancel={() => setIsAccountExistsVisible(false)}
        onClose={() => setIsAccountExistsVisible(false)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F3F4F6",
  },

  topImage: {
    width: "100%",
    height: 220,
    resizeMode: "cover",
  },

  card: {
    backgroundColor: "#FFFFFF",
    marginTop: -30,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 24,
  },

  title: {
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 5,
  },

  subtitle: {
    textAlign: "center",
    color: "#6B7280",
    marginBottom: 25,
  },

  label: {
    fontSize: 13,
    marginTop: 10,
    marginBottom: 4,
    fontWeight: "500",
  },

  error: {
    color: "red",
    fontSize: 12,
    marginBottom: 6,
  },

  termsContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },

  termsText: {
    fontSize: 13,
    marginLeft: 8,
    color: "#444",
  },

  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 20,
  },

  line: {
    flex: 1,
    height: 1,
    backgroundColor: "#E5E7EB",
  },

  orText: {
    marginHorizontal: 10,
    fontSize: 12,
    color: "#999",
  },

  googleButton: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 14,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
  },

  googleText: {
    fontWeight: "500",
  },

  loginContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 20,
  },

  loginText: {
    color: BRAND_COLOR,
    fontWeight: "600",
  },
});