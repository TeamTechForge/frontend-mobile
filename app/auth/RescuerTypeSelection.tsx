import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useState } from "react";
import {
  Alert,
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import BackButton from "../../components/BackButton";
import PrimaryButton from "../../components/PrimaryButton";
import { API_URL } from "../../constants/config.constants";
import { useAuth } from "../../contexts/AuthContext";

const BRAND_COLOR = "#f59e0b";

export default function RescuerTypeScreen() {
  const router = useRouter();
  const { refreshUser } = useAuth();

  const [selectedType, setSelectedType] = useState<
    "volunteer" | "ngo" | "vet" | null
  >(null);

  const [isLoading, setIsLoading] = useState(false);

  const handleContinue = async () => {
    if (!selectedType) {
      Alert.alert("Please select a type");
      return;
    }

    // Retrieve the JWT stored at login/registration
    const token = await SecureStore.getItemAsync("authToken");

    if (!token) {
      Alert.alert("Session expired. Please log in again.");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${API_URL}/auth/select-role`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role: selectedType }),
      });

      const data: any = await response.json();

      if (!response.ok) {
        Alert.alert(data.message || "Failed to select role");
        setIsLoading(false);
        return;
      }

      // Replace stored token with fresh one containing updated role claim
      if (data.token) {
        await SecureStore.setItemAsync("authToken", data.token);
      }

      // Refresh the user context so the root layout sees the updated roleSelected: true and new role
      await refreshUser();

      // Navigate to profile setup without passing userId as a param
      if (selectedType === "volunteer") {
        router.replace("/auth/VolunteerProfileSetup");
      } else if (selectedType === "ngo") {
        router.replace("/auth/NgoProfileSetup");
      } else if (selectedType === "vet") {
        // Use replace to ensure the user cannot return to the type selection screen 
        // once they begin entering their professional vet details.
        router.replace("/auth/VetProfileSetup");
      }
    } catch (error: any) {
      console.error("Rescuer type error:", error);
      Alert.alert("Something went wrong. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackButton onPress={() => router.replace("/auth/RoleSelection")} />
        <Text style={styles.headerTitle}>StrayCare</Text>
      </View>

      {isLoading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={BRAND_COLOR} />
          <Text style={styles.loaderText}>Saving your selection...</Text>
        </View>
      ) : (
        <>
          <Text style={styles.title}>Select Your Rescuer Type</Text>
          <Text style={styles.subtitle}>
            This helps us assign the correct permissions.
          </Text>

          <TouchableOpacity
            style={[
              styles.card,
              selectedType === "volunteer" && styles.activeCard,
            ]}
            onPress={() => setSelectedType("volunteer")}
          >
            <View style={styles.cardRow}>
              <View style={styles.iconBox}>
                <Ionicons name="hand-left-outline" size={18} color="#fff" />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Volunteer</Text>
                <Text style={styles.cardDesc}>
                  Assist with animal rescue in your nearby area.
                </Text>
              </View>

              {selectedType === "volunteer" && (
                <Ionicons name="checkmark-circle" size={20} color={BRAND_COLOR} />
              )}
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.card,
              selectedType === "ngo" && styles.activeCard,
            ]}
            onPress={() => setSelectedType("ngo")}
          >
            <View style={styles.cardRow}>
              <View style={styles.iconBox}>
                <MaterialCommunityIcons
                  name="office-building"
                  size={18}
                  color="#fff"
                />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>NGO / Shelter Organization</Text>
                <Text style={styles.cardDesc}>
                  Coordinate rescues and manage animal shelters.
                </Text>
              </View>

              {selectedType === "ngo" && (
                <Ionicons name="checkmark-circle" size={20} color={BRAND_COLOR} />
              )}
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.card,
              selectedType === "vet" && styles.activeCard,
            ]}
            onPress={() => setSelectedType("vet")}
          >
            <View style={styles.cardRow}>
              <View style={styles.iconBox}>
                <Ionicons name="medkit-outline" size={18} color="#fff" />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Veterinarian</Text>
                <Text style={styles.cardDesc}>
                  Provide medical care and treatments for animals in need.
                </Text>
              </View>

              {selectedType === "vet" && (
                <Ionicons name="checkmark-circle" size={20} color={BRAND_COLOR} />
              )}
            </View>
          </TouchableOpacity>

          <View style={{ marginTop: 20 }}>
            <PrimaryButton
              title="Continue to Profile Setup"
              onPress={handleContinue}
              disabled={!selectedType || isLoading}
            />
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#fff" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    gap: 10,
  },
  headerTitle: { fontSize: 16, fontWeight: "600" },
  title: { fontSize: 20, fontWeight: "bold", marginBottom: 5 },
  subtitle: { color: "#888", marginBottom: 20 },
  card: {
    backgroundColor: "#f7f7f7",
    paddingHorizontal: 15,
    paddingVertical: 28,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#eee",
  },
  activeCard: {
    borderColor: BRAND_COLOR,
    backgroundColor: "#fff7ed",
  },
  cardRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconBox: {
    backgroundColor: BRAND_COLOR,
    padding: 8,
    borderRadius: 8,
  },
  cardTitle: { fontWeight: "bold" },
  cardDesc: { fontSize: 12, color: "#666" },
  loaderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loaderText: {
    marginTop: 10,
    color: "#666",
    fontSize: 14,
  },
});