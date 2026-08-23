import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
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
import * as DocumentPicker from "expo-document-picker";

import { cacheDirectory, makeDirectoryAsync, copyAsync } from "expo-file-system/legacy";

import BackButton from "../../components/BackButton";
import FileUploadField from "../../components/FileUploadField";
import FormSection from "../../components/FormSection";
import InputField from "../../components/InputField";
import PrimaryButton from "../../components/PrimaryButton";
import PayHereSetupGuideModal from "../../components/PayHereSetupGuideModal";
import ProfileImageUpload from "../../components/ProfileImageUpload";
import { API_URL } from "../../constants/config.constants";

const BRAND_COLOR = "#f59e0b";

// Handles NGO profile creation
export default function NgoProfileSetupScreen() {
  const router = useRouter();
  const { refreshUser } = useAuth();

  // Organization Details states
  const [orgName, setOrgName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [regNumber, setRegNumber] = useState("");
  const [year, setYear] = useState("");

  // Contact and location Information
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [bio, setBio] = useState("");
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [geocodedLocationText, setGeocodedLocationText] = useState("");

  // Profile image and document
  const [image, setImage] = useState<string | null>(null);
  const [document, setDocument] = useState(null);

  // Payment details
  const [merchantId, setMerchantId] = useState("");
  const [merchantSecret, setMerchantSecret] = useState("");
  const [payHereAppId, setPayHereAppId] = useState("");
  const [payHereAppSecret, setPayHereAppSecret] = useState("");
  const [paymentValidationError, setPaymentValidationError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPayHereGuide, setShowPayHereGuide] = useState(false);

  const [errors, setErrors] = useState({
    orgName: "",
    contactPerson: "",
    regNumber: "",
    year: "",
    phone: "",
    location: "",
    document: "",
  });

  // Persist form state in a ref so it survives Android Activity recreation
  // (which can happen when ImagePicker opens the system gallery)
  const formPersistRef = useRef<{
    orgName: string; contactPerson: string; regNumber: string; year: string;
    phone: string; location: string; bio: string;
    coords: { latitude: number; longitude: number } | null;
    image: string | null; merchantId: string; merchantSecret: string;
    payHereAppId: string; payHereAppSecret: string;
    geocodedLocationText: string;
  } | null>(null);

  // Mirror all field changes into the persist ref
  useEffect(() => {
    formPersistRef.current = { orgName, contactPerson, regNumber, year, phone, location, bio, coords, image, merchantId, merchantSecret, payHereAppId, payHereAppSecret, geocodedLocationText };
  }, [orgName, contactPerson, regNumber, year, phone, location, bio, coords, image, merchantId, merchantSecret, payHereAppId, payHereAppSecret, geocodedLocationText]);

  //Uploads a local image or document to Cloudinary.
  const uploadToCloudinaryIfLocal = async (uriOrAsset: any, token: string) => {
    if (!uriOrAsset) return null;

    let uri = "";
    let name = "upload_file";
    let mimeType = "image/jpeg";

    // Handle objects returned by ImagePicker and DocumentPicker.
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

    // Upload the file through the backend Cloudinary endpoint.
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
        const errorData = await res.json() as { message?: string };
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

  // Fetch user details on mount, and restore form state if Android recreated the Activity
  useEffect(() => {
    // If we have a persisted snapshot (Android returned from gallery), restore it
    const saved = formPersistRef.current;
    if (saved) {
      if (saved.orgName) setOrgName(saved.orgName);
      if (saved.contactPerson) setContactPerson(saved.contactPerson);
      if (saved.regNumber) setRegNumber(saved.regNumber);
      if (saved.year) setYear(saved.year);
      if (saved.phone) setPhone(saved.phone);
      if (saved.location) setLocation(saved.location);
      if (saved.bio) setBio(saved.bio);
      if (saved.coords) setCoords(saved.coords);
      if (saved.image) setImage(saved.image);
      if (saved.merchantId) setMerchantId(saved.merchantId);
      if (saved.merchantSecret) setMerchantSecret(saved.merchantSecret);
      if (saved.payHereAppId) setPayHereAppId(saved.payHereAppId);
      if (saved.payHereAppSecret) setPayHereAppSecret(saved.payHereAppSecret);
      if (saved.geocodedLocationText) setGeocodedLocationText(saved.geocodedLocationText);
    }

    // Fetch the latest user information from the backend.
    const fetchUser = async () => {
      try {
        const token = await SecureStore.getItemAsync("authToken");
        const response = await fetch(`${API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data: any = await response.json();
        if (response.ok) {
          // Only pre-fill from API if not already restored from persisted state
          if (!saved?.phone && data.phone) setPhone(data.phone);
        }
      } catch (error) {
        console.error("Error fetching user:", error);
      }
    };
    fetchUser();
  }, []);

  //  Opens the device gallery and stores the selected organization image.
  const handlePickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  // location
  const handleGetLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return;

    const loc = await Location.getCurrentPositionAsync({});
    setCoords({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
    const address = await Location.reverseGeocodeAsync(loc.coords);

    if (address.length > 0) {
      const place = `${address[0].city}, ${address[0].country}`;
      setLocation(place);
      setGeocodedLocationText(place);
    }
  };

  // file upload
  const handlePickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/*"],
        copyToCacheDirectory: true,
      });

      if (!result.canceled) {
        // Show the file name in the UI and store the file object
        setDocument(result.assets[0] as any);
      }
    } catch (error) {
      console.error("Document picking error:", error);
      Alert.alert("Failed to pick document");
    }
  };

  /**
   * Validates all required NGO profile fields before submission.
   */
  const validate = () => {
    const newErrors = { orgName: "", contactPerson: "", regNumber: "", year: "", phone: "", location: "", document: "" };
    let valid = true;

    if (!orgName.trim()) { newErrors.orgName = "Organization name is required"; valid = false; }
    if (!contactPerson.trim()) { newErrors.contactPerson = "Contact person is required"; valid = false; }
    if (!regNumber.trim()) { newErrors.regNumber = "Registration number is required"; valid = false; }
    if (!year.trim()) { newErrors.year = "Founded year is required"; valid = false; }
    else if (!/^\d{4}$/.test(year.trim()) || parseInt(year.trim(), 10) > new Date().getFullYear()) { newErrors.year = "Must be a valid 4-digit year"; valid = false; }
    if (!phone.trim()) { newErrors.phone = "Phone number is required"; valid = false; }
    else if (!/^[0-9]{10}$/.test(phone.trim())) { newErrors.phone = "Must be exactly 10 digits (e.g. 0771234567)"; valid = false; }
    if (!location.trim()) { newErrors.location = "Address is required"; valid = false; }
    if (!document) { newErrors.document = "Verification document is required"; valid = false; }

    setErrors(newErrors);
    return valid;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    try {
      // Validate merchant ID and secret relationship
      setPaymentValidationError("");

      if (merchantId && !merchantSecret) {
        setPaymentValidationError("Merchant Secret is required when Merchant ID is provided.");
        return;
      }

      if (merchantSecret && !merchantId) {
        setPaymentValidationError("Merchant ID is required when Merchant Secret is provided.");
        return;
      }

      if ((payHereAppId && !payHereAppSecret) || (!payHereAppId && payHereAppSecret)) {
        setPaymentValidationError("Enter both PayHere App ID and App Secret for recurring donations.");
        return;
      }

      setIsSubmitting(true);
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

      // Upload local files to Cloudinary first
      const uploadedImageUrl = await uploadToCloudinaryIfLocal(image, token);
      const uploadedDocUrl = await uploadToCloudinaryIfLocal(document, token);

      const response = await fetch(`${API_URL}/profiles/ngo`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          orgName,
          contactPerson,
          regNumber,
          foundedYear: year,
          phone,
          location,
          bio,
          profileImage: uploadedImageUrl,
          verificationDocument: uploadedDocUrl,
          merchantId,
          merchantSecret,
          payHereAppId,
          payHereAppSecret,
          latitude: finalCoords?.latitude,
          longitude: finalCoords?.longitude,
        }),
      });

      const data: any = await response.json();
      // Refresh authentication data before moving to verification status.
      if (response.ok) {
        await refreshUser();
        router.replace("/auth/VerificationPending");
      } else {
        Alert.alert(data.message ? `${data.message}${data.error ? `: ${data.error}` : ""}` : "Failed to save profile");
      }
    } catch (error: any) {
      console.error("Profile submission error:", error);
      Alert.alert(error.message || "Something went wrong. Please check connection.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>

      {/* Header */}
      <View style={styles.header}>
        <BackButton onPress={() => router.replace("/auth/RescuerTypeSelection")} />

        <Text style={styles.headerTitle}>NGO{"\n"}Profile Setup</Text>

        <View style={styles.verificationBadge}>
          <Ionicons name="shield-checkmark-outline" size={12} color={BRAND_COLOR} />
          <Text style={styles.verificationText}>VERIFICATION REQUIRED</Text>
        </View>
      </View>

      {/* Title */}
      <Text style={styles.mainTitle}>Complete Your Profile</Text>
      <Text style={styles.subtitle}>
        Join as an organization to coordinate large-scale rescues.
      </Text>

      {/* Profile Image */}
      <ProfileImageUpload
        imageUri={image}
        onPress={handlePickImage}
        label="Upload organization logo"
        icon="business-outline"
      />

      {/* ORGANIZATION DETAILS */}
      <FormSection title="Organization Details">
        <InputField label="Organization Name *" placeholder="e.g. Save The Strays Foundation" value={orgName} onChangeText={setOrgName} error={errors.orgName} />
        <InputField label="Contact Person Name *" placeholder="e.g. Kasun Perera" value={contactPerson} onChangeText={setContactPerson} error={errors.contactPerson} />
        <InputField label="Registration Number *" placeholder="e.g. L-62414" value={regNumber} onChangeText={setRegNumber} error={errors.regNumber} />
        <InputField label="Founded Year *" placeholder="e.g. 2015" value={year} onChangeText={setYear} keyboardType="numeric" error={errors.year} />
      </FormSection>

      {/* CONTACT */}
      <FormSection title="Contact & Location">
        <InputField
          label="Phone Number *"
          placeholder="e.g. 0771234567"
          value={phone}
          onChangeText={setPhone}
          icon="call-outline"
          keyboardType="phone-pad"
          error={errors.phone}
        />

        <InputField
          label="Address *"
          placeholder="e.g. 123 Rescue Road, Colombo 07"
          value={location}
          onChangeText={setLocation}
          icon="location-outline"
          error={errors.location}
          rightIcon="locate-outline"
          onRightIconPress={handleGetLocation}
        />
      </FormSection>

      {/* BIO */}
      <FormSection title="About Organization">
        <View style={styles.bioWrapper}>
          <Text style={styles.fieldLabel}>Organization Bio</Text>
          <TextInput
            style={styles.textArea}
            placeholder="Tell us about your organization's mission and history..."
            value={bio}
            onChangeText={(text) => {
              if (text.length <= 500) setBio(text);
            }}
            multiline
            placeholderTextColor="#999"
          />
          <Text style={styles.charCount}>{bio.length}/500</Text>
        </View>
      </FormSection>

      {/* VERIFICATION */}
      <FormSection title="Verification Documents *">
        <FileUploadField file={document} onPick={handlePickFile} />
        {errors.document ? (
          <Text style={styles.errorText}>{errors.document}</Text>
        ) : null}
        <Text style={styles.helperText}>
          Upload NGO registration documents for verification.
        </Text>
      </FormSection>

      {/* PAYMENT */}
      <FormSection title="Donation Settings">
        <Text style={styles.donationDescription}>
          If you wish to receive donations for rescue cases, please provide your payment details below.
        </Text>

        <InputField
          label="Pay Here Merchant ID"
          placeholder="e.g. PH1234567"
          value={merchantId}
          onChangeText={setMerchantId}
        />

        <InputField
          label="Merchant Secret"
          placeholder="Enter Merchant Secret"
          value={merchantSecret}
          onChangeText={setMerchantSecret}
          secure={true}
        />

        <Text style={styles.donationDescription}>
          To receive recurring donations, provide the App ID and App Secret from your PayHere API key below.
        </Text>

        <InputField
          label="PayHere App ID (For recurring)"
          placeholder="Enter App ID to enable recurring donations"
          value={payHereAppId}
          onChangeText={setPayHereAppId}
        />

        <InputField
          label="PayHere App Secret"
          placeholder="Enter App Secret"
          value={payHereAppSecret}
          onChangeText={setPayHereAppSecret}
          secure={true}
        />

        {paymentValidationError && (
          <Text style={styles.errorText}>{paymentValidationError}</Text>
        )}

        <Text style={styles.helperText}>
          Optional. Required only if you wish to receive donations through your merchant account.
        </Text>
        <TouchableOpacity
          style={styles.payHereHelpLink}
          onPress={() => setShowPayHereGuide(true)}
        >
          <Ionicons name="help-circle-outline" size={16} color="#B45309" />
          <Text style={styles.payHereHelpText}>How to get PayHere credentials</Text>
        </TouchableOpacity>
      </FormSection>

      {/* BUTTON */}
      <PrimaryButton
        title={isSubmitting ? "Uploading files..." : "Submit for Verification"}
        onPress={handleSubmit}
        disabled={isSubmitting}
      />
      <PayHereSetupGuideModal visible={showPayHereGuide} onClose={() => setShowPayHereGuide(false)} />

      <View style={{ height: 40 }} />
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
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 10,
    lineHeight: 18,
  },
  verificationBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF4E5",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 4,
  },
  verificationText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#9A6A00",
  },
  mainTitle: {
    textAlign: "center",
    fontSize: 28,
    fontWeight: "700",
    color: "#222",
    marginBottom: 8,
  },
  subtitle: {
    textAlign: "center",
    fontSize: 13,
    color: "#666",
    marginBottom: 22,
    lineHeight: 18,
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
    minHeight: 100,
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
  helperText: {
    marginTop: 8,
    fontSize: 11,
    color: "#888",
  },
  donationDescription: {
    fontSize: 12,
    color: "#666",
    marginBottom: 8,
    lineHeight: 18,
  },
  payHereHelpLink: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", marginTop: 4 },
  payHereHelpText: { color: "#B45309", fontSize: 12, fontWeight: "700" },
  errorText: {
    color: "red",
    fontSize: 12,
    marginTop: 6,
  },
});
