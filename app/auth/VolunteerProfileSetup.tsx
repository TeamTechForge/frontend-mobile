import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useEffect, useState } from "react";

import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";

import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";

import { cacheDirectory, makeDirectoryAsync, copyAsync } from "expo-file-system/legacy";
import BackButton from "../../components/BackButton";
import FormSection from "../../components/FormSection";
import InputField from "../../components/InputField";
import PrimaryButton from "../../components/PrimaryButton";
import ProfileImageUpload from "../../components/ProfileImageUpload";
import { API_URL } from "../../constants/config.constants";
import { useAuth } from "../../contexts/AuthContext";

const BRAND_COLOR = "#F5A623";

export default function VolunteerProfileSetupScreen() {
  const router = useRouter();
  const { refreshUser } = useAuth();

  const [profileImage, setProfileImage] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [bio, setBio] = useState("");
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [geocodedLocationText, setGeocodedLocationText] = useState("");

  const [errors, setErrors] = useState({
    name: "",
    phone: "",
    location: "",
  });

  // Load existing user details when the screen opens.
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const token = await SecureStore.getItemAsync("authToken");
        const response = await fetch(`${API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data: any = await response.json();
        if (response.ok) {
          if (data.name) setName(data.name);
          if (data.phone) setPhone(data.phone);
        }
      } catch (error) {
        console.error("Error fetching user:", error);
      }
    };
    fetchUser();
  }, []);

  // Upload a local image to Cloudinary and return its hosted URL.
  const uploadToCloudinaryIfLocal = async (uriOrAsset: any, token: string) => {
    if (!uriOrAsset) return null;

    let uri = "";
    let name = "upload_file";
    let mimeType = "image/jpeg";

    if (typeof uriOrAsset === "object" && uriOrAsset.uri) {
      uri = uriOrAsset.uri;
      name = uriOrAsset.name || "upload_file";
      mimeType = uriOrAsset.mimeType || "application/octet-stream";
    } else if (typeof uriOrAsset === "string" && (uriOrAsset.startsWith("file://") || uriOrAsset.startsWith("content://"))) {
      uri = uriOrAsset;
      const filename = uri.split("/").pop();
      if (filename) name = filename;
    } else if (typeof uriOrAsset === "string") {
      return uriOrAsset;
    } else {
      return null;
    }

    // Resolve content:// URIs to local file:// URIs using expo-file-system
    if (uri.startsWith("content://")) {
      try {
        const cacheDir = `${cacheDirectory}UploadCache/`;
        await makeDirectoryAsync(cacheDir, { intermediates: true }).catch(() => { });
        const localUri = `${cacheDir}${name}`;
        await copyAsync({ from: uri, to: localUri });
        uri = localUri;
      } catch (err) {
        console.error("Failed to copy content URI to local cache:", err);
      }
    }
    // Send the image to the backend upload endpoint.
    const formData = new FormData();
    formData.append("file", {
      uri,
      name,
      type: mimeType,
    } as any);

    const res = await fetch(`${API_URL}/upload/cloudinary`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData as any,
    });

    if (!res.ok) {
      let errorMsg = "Failed to upload file to Cloudinary";
      try {
        const errorData: any = await res.json();
        if (errorData && errorData.message) {
          errorMsg = errorData.message;
        }
      } catch (e) {
        // use default error message
      }
      throw new Error(errorMsg);
    }

    const data: any = await res.json();
    return data.url;
  };

  // Open the gallery and select a profile image.
  const handlePickProfileImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert("Permission to access gallery is required.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      quality: 0.7,
      allowsEditing: true,
      aspect: [1, 1],
    });

    if (!result.canceled) {
      setProfileImage(result.assets[0].uri);
    }
  };

  // Get the user's current location and convert it to a readable address.
  const handleGetLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();

    if (status !== "granted") {
      Alert.alert("Permission denied for location.");
      return;
    }

    const loc = await Location.getCurrentPositionAsync({});
    setCoords({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });

    const address = await Location.reverseGeocodeAsync({
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
    });

    if (address.length > 0) {
      const place = `${address[0].city || ""}, ${address[0].country || ""}`;
      setLocation(place);
      setGeocodedLocationText(place);
    }
  };

  // Validate the required profile fields.
  const validate = () => {
    const newErrors = {
      name: "",
      phone: "",
      location: "",
    };

    let valid = true;

    if (!name.trim()) {
      newErrors.name = "Name is required";
      valid = false;
    }

    if (!phone.trim()) {
      newErrors.phone = "Phone number is required";
      valid = false;
    } else if (!/^[0-9]{10}$/.test(phone.trim())) {
      newErrors.phone = "Must be exactly 10 digits (e.g. 0771234567)";
      valid = false;
    }

    if (!location.trim()) {
      newErrors.location = "Current location is required";
      valid = false;
    }

    setErrors(newErrors);
    return valid;
  };

  // Validate the form, upload the image, and save the profile.
  const handleSubmit = async () => {
    if (!validate()) return;

    try {
      const token = await SecureStore.getItemAsync("authToken");
      if (!token) throw new Error("No authorization token found");

      // Convert a manually entered location into coordinates.
      let finalCoords = coords;
      if (location.trim() !== geocodedLocationText.trim()) {
        try {
          const geo = await Location.geocodeAsync(location);
          if (geo.length > 0) {
            finalCoords = { latitude: geo[0].latitude, longitude: geo[0].longitude };
            setCoords(finalCoords);
            setGeocodedLocationText(location);
          }
        } catch (e) {
          console.warn("Geocoding failed:", e);
        }
      }

      // Upload the selected profile image before saving the profile.
      const uploadedImageUrl = await uploadToCloudinaryIfLocal(profileImage, token);

      const response = await fetch(`${API_URL}/profiles/volunteer`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name,
          phone,
          location,
          bio,
          profileImage: uploadedImageUrl,
          latitude: finalCoords?.latitude,
          longitude: finalCoords?.longitude,
        }),
      });

      const data: any = await response.json();
      if (response.ok) {
        await refreshUser();
        router.replace("/auth/CompletedProfileSetup");
      } else {
        Alert.alert(data.message || "Failed to save profile");
      }
    } catch (error) {
      console.error("Profile submission error:", error);
      Alert.alert("Something went wrong. Please check connection.");
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Header */}
      <View style={styles.header}>
        <BackButton onPress={() => router.replace("/auth/RescuerTypeSelection")} />

        <Text style={styles.headerTitle}>Volunteer{"\n"}Profile Setup</Text>
      </View>

      {/* Title */}
      <Text style={styles.mainTitle}>Complete Your Profile</Text>
      <Text style={styles.subtitle}>
        Join the rescue community and help animals in need.
      </Text>

      {/* Profile Image */}
      <ProfileImageUpload
        imageUri={profileImage}
        onPress={handlePickProfileImage}
      />

      {/* Basic Information */}
      <FormSection title="Basic Information">
        <InputField
          label="Name *"
          placeholder="e.g. Alex Johnson"
          value={name}
          onChangeText={setName}
          error={errors.name}
        />

        <InputField
          label="Phone Number *"
          placeholder="e.g. 0771234567"
          value={phone}
          onChangeText={setPhone}
          error={errors.phone}
        />

        <InputField
          label="Current Location *"
          placeholder="City, Country"
          value={location}
          onChangeText={setLocation}
          rightIcon="locate-outline"
          onRightIconPress={handleGetLocation}
          error={errors.location}
        />

        <View style={styles.bioWrapper}>
          <Text style={styles.fieldLabel}>Short Bio</Text>
          <TextInput
            style={styles.textArea}
            placeholder="Tell us about yourself and why you want to help animals."
            value={bio}
            onChangeText={(text) => {
              if (text.length <= 150) setBio(text);
            }}
            multiline
            placeholderTextColor="#999"
          />
        </View>
      </FormSection>

      {/* Submit */}
      <PrimaryButton title="Complete Registration" onPress={handleSubmit} />

      <Text style={styles.footerNote}>
        You can update your profile anytime from settings.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 30,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 10,
    lineHeight: 18,
  },
  mainTitle: {
    textAlign: "center",
    fontSize: 32,
    fontWeight: "700",
    color: "#222",
    marginBottom: 8,
    lineHeight: 36,
  },
  subtitle: {
    textAlign: "center",
    fontSize: 13,
    color: "#666",
    marginBottom: 26,
    lineHeight: 18,
  },
  imageSection: {
    alignItems: "center",
    marginBottom: 22,
  },
  avatarWrapper: {
    position: "relative",
  },
  avatarPlaceholder: {
    width: 95,
    height: 95,
    borderRadius: 48,
    borderWidth: 1.5,
    borderColor: BRAND_COLOR,
    borderStyle: "dashed",
    backgroundColor: "#FFF9F0",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarImage: {
    width: 95,
    height: 95,
    borderRadius: 48,
  },
  editIcon: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: BRAND_COLOR,
    justifyContent: "center",
    alignItems: "center",
  },
  uploadText: {
    marginTop: 10,
    fontSize: 12,
    color: "#666",
  },
  bioWrapper: {
    marginTop: 8,
  },
  fieldLabel: {
    fontSize: 13,
    marginBottom: 6,
    fontWeight: "500",
  },
  textArea: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    minHeight: 90,
    backgroundColor: "#f9f9f9",
    textAlignVertical: "top",
    fontSize: 14,
    color: "#000",
  },
  footerNote: {
    textAlign: "center",
    fontSize: 11,
    color: "#888",
    marginTop: 8,
  },
});