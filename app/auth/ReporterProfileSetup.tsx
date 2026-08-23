import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  KeyboardAvoidingView,
  Platform
} from "react-native";

import { cacheDirectory, makeDirectoryAsync, copyAsync } from "expo-file-system/legacy";
import BackButton from "../../components/BackButton";
import InputField from "../../components/InputField";
import PrimaryButton from "../../components/PrimaryButton";
import ProfileImageUpload from "../../components/ProfileImageUpload";
import { API_URL } from "../../constants/config.constants";

const BRAND_COLOR = "#f59e0b";

export default function ReporterProfileSetupScreen() {
  const router = useRouter();
  const { refreshUser } = useAuth();

  // Store profile information entered by the reporter
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [bio, setBio] = useState("");
  const [image, setImage] = useState<string | null>(null);

  const [errors, setErrors] = useState({
    name: "",
    phone: "",
    location: "",
  });

  // Fetch existing user information when the screen loads
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const token = await SecureStore.getItemAsync("authToken");
        const response = await fetch(`${API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data: any = await response.json();
        // Pre-fill fields with existing account information
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

  // Upload a local image to Cloudinary and return its URL
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

    const formData = new FormData();
    formData.append("file", {
      uri,
      name,
      type: mimeType,
    } as any);

    // Send the image to the backend upload endpoint
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
    // Return the uploaded Cloudinary URL
    const data: any = await res.json();
    return data.url;
  };

  // Open the device gallery and select a profile image
  const handlePickImage = async () => {
    // ask permission
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert("Permission to access gallery is required!");
      return;
    }

    // open gallery
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      quality: 0.7,
      allowsEditing: true,
      aspect: [1, 1],
    });
    // Save the selected image URI
    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };
  // Detect the reporter's current location
  const handleGetLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();

    if (status !== "granted") {
      Alert.alert("Permission denied for location");
      return;
    }
    // Get the current GPS coordinates
    const loc = await Location.getCurrentPositionAsync({});
    // Reverse geocode the coordinates to get the address
    const address = await Location.reverseGeocodeAsync({
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
    });
    // Update the location field with the detected address
    if (address.length > 0) {
      const place = `${address[0].city || ""}, ${address[0].country || ""}`;
      setLocation(place);
    }
  };

  // Validate all required profile fields
  const validate = () => {
    let valid = true;
    let newErrors = { name: "", phone: "", location: "" };

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
      newErrors.location = "Location is required";
      valid = false;
    }

    setErrors(newErrors);
    return valid;
  };

  // Submit the completed reporter profile
  const handleSubmit = async () => {
    if (!validate()) return;

    try {
      const token = await SecureStore.getItemAsync("authToken");
      if (!token) throw new Error("No authorization token found");

      const uploadedImageUrl = await uploadToCloudinaryIfLocal(image, token);

      // Save profile details to the backend
      const response = await fetch(`${API_URL}/profiles/general`, {
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
        }),
      });

      // Refresh authentication data and navigate after successful submission
      const data: any = await response.json();
      if (response.ok) {
        await refreshUser();
        router.replace("/auth/CompletedProfileSetup");
      } else {
        Alert.alert(data.message || "Failed to save profile");
      }
    } catch (error: any) {
      console.error("Profile submission error:", error);
      Alert.alert("Something went wrong. Please check connection.");
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>

      {/* Header */}
      <View style={styles.header}>
        <BackButton onPress={() => router.replace("/auth/RoleSelection")} />

        <Text style={styles.headerTitle}>Reporter Profile Setup</Text>
      </View>

      {/* Title */}
      <Text style={styles.mainTitle}>Complete Your Profile</Text>
      <Text style={styles.subtitle}>
        Join the community to help animals and report strays.
      </Text>

      {/* Profile Image (optional) */}
      <ProfileImageUpload
        imageUri={image}
        onPress={handlePickImage}
      />

      {/* Name */}
      <InputField
        label="Name *"
        placeholder="e.g. John Doe"
        value={name}
        onChangeText={setName}
        icon="person-outline"
        error={errors.name}
      />

      {/* Phone */}
      <InputField
        label="Phone Number *"
        placeholder="e.g. 0771234567"
        value={phone}
        onChangeText={setPhone}
        icon="call-outline"
        keyboardType="phone-pad"
        error={errors.phone}
      />

      {/* Location */}
      <InputField
        label="Location *"
        placeholder="e.g. Colombo, Sri Lanka"
        value={location}
        onChangeText={setLocation}
        icon="location-outline"
        rightIcon="locate-outline"
        onRightIconPress={handleGetLocation}
        error={errors.location}
      />

      {/* Bio */}
      <View style={styles.bioWrapper}>
        <Text style={styles.fieldLabel}>Short Bio (Optional)</Text>
        <TextInput
          style={styles.textArea}
          placeholder="Tell us a bit about yourself and why you want to help animals..."
          value={bio}
          onChangeText={(text) => {
            if (text.length <= 150) setBio(text);
          }}
          multiline
          placeholderTextColor="#999"
        />
        <Text style={styles.charCount}>{bio.length}/150</Text>
      </View>

      {/* Button */}
      <View style={{ marginTop: 20 }}>
        <PrimaryButton
          title="Complete Registration"
          onPress={handleSubmit}
        />
      </View>
      </ScrollView>
    </KeyboardAvoidingView>
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
    marginBottom: 20,
    gap: 10,
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

  imageContainer: {
    alignItems: "center",
    marginBottom: 20,
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
  charCount: {
    textAlign: "right",
    fontSize: 11,
    color: "#888",
    marginTop: 4,
  },
  error: {
    color: "red",
    fontSize: 12,
    marginTop: 4,
  },
});
