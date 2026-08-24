import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View, Image } from "react-native";

import PrimaryButton from "../../components/PrimaryButton";
import { useAuth } from "../../contexts/AuthContext";
import { API_URL } from "../../constants/config.constants";

const BRAND_COLOR = "#F5A623";

export default function OnboardingCompleteScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const userName = user?.name || "User";



  const handleGetStarted = () => {
    router.replace("/(tabs)/Home");
  };

  return (
    <View style={styles.container}>
      {/* Logo Section */}
      <View style={styles.logoSection}>
        <View style={styles.logoCircle}>
          <Image
            source={require("../../assets/images/straycarelogo.png")}
            style={styles.logoImage}
          />
        </View>

      </View>

      {/* Success Illustration */}
      <View style={styles.successSection}>
        <View style={styles.outerRing}>
          <View style={styles.dotGreen} />
          <View style={styles.dotOrangeTop} />
          <View style={styles.dotOrangeBottom} />

          <View style={styles.successCircle}>
            <Text style={styles.checkMark}>✓</Text>
          </View>
        </View>
      </View>

      {/* Text */}
      <Text style={styles.title}>Profile Setup Complete!</Text>
      <Text style={styles.subtitle}>You're All Set, {userName} !</Text>

      {/* Button */}
      <View style={styles.buttonWrapper}>
        <PrimaryButton title="Get Started" onPress={handleGetStarted} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    paddingHorizontal: 24,
    paddingTop: 54,
    paddingBottom: 32,
    justifyContent: "space-between",
  },
  logoSection: {
    alignItems: "center",
    marginTop: 6,
  },
  logoCircle: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: "#f5f5f5",
    justifyContent: "center",
    alignItems: "center",
  },
  logoImage: {
    width: 150,
    height: 150,
    resizeMode: "contain",
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#D8892E",
    letterSpacing: 0.8,
  },
  brandSubtitle: {
    fontSize: 13,
    color: "#8C5B2C",
    fontWeight: "600",
    marginTop: 2,
  },
  successSection: {
    alignItems: "center",
    marginTop: -30,
  },
  outerRing: {
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: "#FCF6EA",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  successCircle: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  checkMark: {
    fontSize: 48,
    color: "#2DBE60",
    fontWeight: "700",
    lineHeight: 52,
  },
  dotGreen: {
    position: "absolute",
    left: 24,
    top: 70,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#B6E8A5",
  },
  dotOrangeTop: {
    position: "absolute",
    right: 22,
    top: 28,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#F4B000",
  },
  dotOrangeBottom: {
    position: "absolute",
    right: 58,
    bottom: 24,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#F4B000",
  },
  title: {
    textAlign: "center",
    fontSize: 20,
    fontWeight: "700",
    color: "#222",
    marginTop: -80,
  },
  subtitle: {
    textAlign: "center",
    fontSize: 17,
    color: "#444",
    marginTop: -80,
  },
  buttonWrapper: {
    marginBottom: 10,
  },
});