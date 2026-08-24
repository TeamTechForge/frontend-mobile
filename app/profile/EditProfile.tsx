import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { Alert, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, ActivityIndicator } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import * as DocumentPicker from "expo-document-picker";
import { cacheDirectory, makeDirectoryAsync, copyAsync } from "expo-file-system/legacy";
import InputField from "../../components/InputField";
import PrimaryButton from "../../components/PrimaryButton";
import FileUploadField from "../../components/FileUploadField";
import { API_URL } from "../../constants/config.constants";
import { SafeAreaView } from "react-native-safe-area-context";
import ImageViewer from "../../components/ui/ImageViewer";
import BackButton from "../../components/BackButton";

const BRAND_COLOR = "#F5A623";

export default function EditProfileScreen() {
  const router = useRouter();

  // Common user fields
  const [role, setRole] = useState("general_user");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  // Common profile fields
  const [location, setLocation] = useState("");
  const [bio, setBio] = useState("");
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [geocodedLocationText, setGeocodedLocationText] = useState("");

  // Vet & NGO Common
  const [merchantId, setMerchantId] = useState("");
  const [merchantSecret, setMerchantSecret] = useState("");
  const [payHereAppId, setPayHereAppId] = useState("");
  const [payHereAppSecret, setPayHereAppSecret] = useState("");
  const [recurringPaymentsEnabled, setRecurringPaymentsEnabled] = useState(false);

  // Vet Specific
  const [clinicName, setClinicName] = useState("");
  const [clinicAddress, setClinicAddress] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [yearsOfExperience, setYearsOfExperience] = useState("");
  const [licenseDocument, setLicenseDocument] = useState<any>(null);

  // NGO Specific
  const [orgName, setOrgName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [regNumber, setRegNumber] = useState("");
  const [foundedYear, setFoundedYear] = useState("");
  const [verificationDocument, setVerificationDocument] = useState<any>(null);

  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isViewerVisible, setIsViewerVisible] = useState(false);

  const [errors, setErrors] = useState({
    name: "", phone: "", location: "", orgName: "", contactPerson: "", 
    regNumber: "", foundedYear: "", clinicName: "", clinicAddress: "", 
    licenseNumber: "", yearsOfExperience: "",
  });

  const uploadToCloudinaryIfLocal = async (uriOrAsset: any, token: string) => {
    if (!uriOrAsset) return null;

    let uri = "";
    let nameStr = "upload_file";
    let mimeType = "image/jpeg";

    if (typeof uriOrAsset === "object" && uriOrAsset.uri) {
      uri = uriOrAsset.uri;
      nameStr = uriOrAsset.name || "upload_file";
      mimeType = uriOrAsset.mimeType || "application/octet-stream";
    } else if (typeof uriOrAsset === "string" && (uriOrAsset.startsWith("file://") || uriOrAsset.startsWith("content://"))) {
      uri = uriOrAsset;
      const filename = uri.split("/").pop();
      if (filename) nameStr = filename;
    } else if (typeof uriOrAsset === "string") {
      return uriOrAsset;
    } else {
      return null;
    }

    if (uri.startsWith("content://")) {
      try {
        const cacheDir = `${cacheDirectory}UploadCache/`;
        await makeDirectoryAsync(cacheDir, { intermediates: true }).catch(() => { });
        const localUri = `${cacheDir}${nameStr}`;
        await copyAsync({ from: uri, to: localUri });
        uri = localUri;
      } catch (err) {
        console.error("Failed to copy content URI to local cache:", err);
      }
    }

    const formData = new FormData();
    formData.append("file", {
      uri,
      name: nameStr,
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

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const fetchData = async () => {
        try {
          const token = await SecureStore.getItemAsync("authToken");
          if (!token) return;

          const userRes = await fetch(`${API_URL}/auth/me`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const userData: any = await userRes.json();
          if (userRes.ok && isActive) {
            setName(userData.name || "");
            setEmail(userData.email || "");
            setPhone(userData.phone || "");
            setRole(userData.role || "general_user");
          }

          const profileRes = await fetch(`${API_URL}/profiles/me`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const profileData: any = await profileRes.json();
          if (profileRes.ok && isActive) {
            setBio(profileData.bio || "");
            setProfileImage(profileData.profileImage || userData.avatar || null);

            if (userData.role === "vet") {
              setLocation(profileData.primaryLocation || "");
              setClinicName(profileData.clinicName || "");
              setClinicAddress(profileData.clinicAddress || "");
              setLicenseNumber(profileData.licenseNumber || "");
              setYearsOfExperience(profileData.yearsOfExperience !== undefined && profileData.yearsOfExperience !== null ? String(profileData.yearsOfExperience) : "");
              setLicenseDocument(profileData.licenseDocument || null);
              setMerchantId(profileData.merchantId || "");
              setMerchantSecret(profileData.merchantSecret || "");
              setRecurringPaymentsEnabled(profileData.recurringPaymentsEnabled === true);
            } else if (userData.role === "ngo") {
              setLocation(profileData.location || "");
              setOrgName(profileData.orgName || "");
              setContactPerson(profileData.contactPerson || "");
              setRegNumber(profileData.regNumber || "");
              setFoundedYear(profileData.foundedYear || "");
              setVerificationDocument(profileData.verificationDocument || null);
              setMerchantId(profileData.merchantId || "");
              setMerchantSecret(profileData.merchantSecret || "");
              setRecurringPaymentsEnabled(profileData.recurringPaymentsEnabled === true);
            } else {
              setLocation(profileData.location || "");
            }
          }
        } catch (error) {
          console.error("Fetch profile edit data error:", error);
        } finally {
          if (isActive) setLoading(false);
        }
      };
      fetchData();

      return () => {
        isActive = false;
      };
    }, [])
  );

  const handlePickProfileImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: true,
      aspect: [1, 1],
    });

    if (!result.canceled) {
      setProfileImage(result.assets[0].uri);
    }
  };

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/*"],
        copyToCacheDirectory: true,
      });

      if (!result.canceled) {
        if (role === "vet") setLicenseDocument(result.assets[0]);
        else if (role === "ngo") setVerificationDocument(result.assets[0]);
      }
    } catch (error) {
      console.error("Document picking error:", error);
      Alert.alert("Failed to pick document");
    }
  };

  const handleGetLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return;

    const loc = await Location.getCurrentPositionAsync({});
    setCoords({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
    const address = await Location.reverseGeocodeAsync(loc.coords);

    if (address.length > 0) {
      const place = `${address[0].city || ""}, ${address[0].country || ""}`;
      setLocation(place);
      setGeocodedLocationText(place);
    }
  };

  const validate = () => {
    let valid = true;
    let newErrors = {
      name: "", phone: "", location: "", orgName: "", contactPerson: "", regNumber: "", foundedYear: "", clinicName: "", clinicAddress: "", licenseNumber: "", yearsOfExperience: "",
    };

    if (role !== "ngo" && !name.trim()) { newErrors.name = "Name is required"; valid = false; }
    if (!phone.trim()) { newErrors.phone = "Phone number is required"; valid = false; }
    else if (!/^[0-9]{10}$/.test(phone.trim())) { newErrors.phone = "Must be exactly 10 digits (e.g. 0771234567)"; valid = false; }
    if (!location.trim()) { newErrors.location = "Location is required"; valid = false; }

    if (role === "vet") {
      if (!clinicName.trim()) { newErrors.clinicName = "Clinic name is required"; valid = false; }
      if (!clinicAddress.trim()) { newErrors.clinicAddress = "Clinic address is required"; valid = false; }
      if (!licenseNumber.trim()) { newErrors.licenseNumber = "License number is required"; valid = false; }
      if (!yearsOfExperience.trim()) { newErrors.yearsOfExperience = "Years of experience is required"; valid = false; }
      else if (isNaN(Number(yearsOfExperience.trim())) || Number(yearsOfExperience.trim()) < 0 || Number(yearsOfExperience.trim()) > 100) {
        newErrors.yearsOfExperience = "Must be a valid number";
        valid = false;
      }
    }

    if (role === "ngo") {
      if (!orgName.trim()) { newErrors.orgName = "Organization name is required"; valid = false; }
      if (!contactPerson.trim()) { newErrors.contactPerson = "Contact person is required"; valid = false; }
      if (!regNumber.trim()) { newErrors.regNumber = "Registration number is required"; valid = false; }
      if (!foundedYear.trim()) { newErrors.foundedYear = "Founded year is required"; valid = false; }
      else if (!/^\d{4}$/.test(foundedYear.trim()) || parseInt(foundedYear.trim(), 10) > new Date().getFullYear()) {
        newErrors.foundedYear = "Must be a valid 4-digit year";
        valid = false;
      }
    }

    setErrors(newErrors);
    return valid;
  };

  const handleSaveChanges = async () => {
    if (!validate()) {
      return;
    }

    if ((payHereAppId && !payHereAppSecret) || (!payHereAppId && payHereAppSecret)) {
      Alert.alert("Recurring setup", "Enter both the PayHere App ID and App Secret.");
      return;
    }

    try {
      setIsSubmitting(true);
      const token = await SecureStore.getItemAsync("authToken");
      if (!token) throw new Error("No authorization token found");

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

      const uploadedImageUrl = await uploadToCloudinaryIfLocal(profileImage, token);

      let endpoint = "/profiles/general";
      let body: any = {};

      if (role === "general_user") {
        endpoint = "/profiles/general";
        body = { name, phone, location, bio, profileImage: uploadedImageUrl, latitude: finalCoords?.latitude, longitude: finalCoords?.longitude };
      } else if (role === "volunteer") {
        endpoint = "/profiles/volunteer";
        body = { name, phone, location, bio, profileImage: uploadedImageUrl, latitude: finalCoords?.latitude, longitude: finalCoords?.longitude };
      } else if (role === "vet") {
        endpoint = "/profiles/vet";
        const uploadedDocUrl = await uploadToCloudinaryIfLocal(licenseDocument, token);
        body = {
          name,
          phone,
          primaryLocation: location,
          bio,
          clinicName,
          clinicAddress,
          licenseNumber,
          yearsOfExperience,
          profileImage: uploadedImageUrl,
          licenseDocument: uploadedDocUrl,
          merchantId,
          merchantSecret,
          payHereAppId,
          payHereAppSecret,
          latitude: finalCoords?.latitude,
          longitude: finalCoords?.longitude,
        };
      } else if (role === "ngo") {
        endpoint = "/profiles/ngo";
        const uploadedDocUrl = await uploadToCloudinaryIfLocal(verificationDocument, token);
        body = {
          orgName,
          phone,
          contactPerson,
          regNumber,
          foundedYear,
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
        };
      }

      const response = await fetch(`${API_URL}${endpoint}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        Alert.alert("Profile updated successfully");
        router.back();
      } else {
        const data: any = await response.json();
        Alert.alert(data.message ? `${data.message}${data.error ? `: ${data.error}` : ""}` : "Failed to update profile");
      }
    } catch (error: any) {
      console.error("Update profile error:", error);
      Alert.alert(error.message || "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={BRAND_COLOR} />
      </View>
    );
  }

  const roleTitle = role === "vet" ? "Vet" : role === "ngo" ? "NGO" : role === "volunteer" ? "Volunteer" : "User";

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <BackButton onPress={() => router.back()} />
          <Text style={styles.headerTitle}>Edit {roleTitle} Profile</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.imageSection}>
          <View style={styles.avatarWrapper}>
            {profileImage ? (
              <TouchableOpacity onPress={() => setIsViewerVisible(true)}>
                <Image source={{ uri: profileImage }} style={styles.avatarImage} />
              </TouchableOpacity>
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="person" size={50} color="#F3E5D8" />
              </View>
            )}
            <TouchableOpacity style={styles.cameraIcon} onPress={handlePickProfileImage}>
              <Ionicons name="camera-outline" size={14} color="#fff" />
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={handlePickProfileImage}>
            <Text style={styles.changePhotoText}>Change Profile Photo</Text>
          </TouchableOpacity>
        </View>

        {role === "ngo" ? (
          <>
            <Text style={styles.label}>Organization Name</Text>
            <InputField value={orgName} onChangeText={setOrgName} placeholder="Enter org name" error={errors.orgName} />
          </>
        ) : (
          <>
            <Text style={styles.label}>Full Name</Text>
            <InputField value={name} onChangeText={setName} placeholder="Enter name" editable={true} error={errors.name} />
          </>
        )}

        {role !== "ngo" && role !== "vet" && (
          <>
            <Text style={styles.label}>Email Address</Text>
            <InputField value={email} onChangeText={setEmail} placeholder="Enter email" editable={false} />
          </>
        )}

        <Text style={styles.label}>{role === "vet" ? "Primary Location" : "Location"}</Text>
        <InputField
          value={location}
          onChangeText={setLocation}
          placeholder="Enter location"
          icon="location-outline"
          rightIcon="locate-outline"
          onRightIconPress={handleGetLocation}
          error={errors.location}
        />

        <Text style={styles.label}>Phone Number</Text>
        <InputField value={phone} onChangeText={setPhone} placeholder="e.g. 0771234567" editable={true} error={errors.phone} />

        {role === "ngo" && (
          <>
            <Text style={styles.label}>Contact Person</Text>
            <InputField value={contactPerson} onChangeText={setContactPerson} placeholder="Enter contact person" error={errors.contactPerson} />
            <Text style={styles.label}>Registration Number</Text>
            <InputField value={regNumber} onChangeText={setRegNumber} placeholder="Enter reg number" error={errors.regNumber} />
            <Text style={styles.label}>Founded Year</Text>
            <InputField value={foundedYear} onChangeText={setFoundedYear} placeholder="e.g. 2015" error={errors.foundedYear} />
          </>
        )}

        <View style={styles.bioSection}>
          <Text style={styles.bioLabel}>Short Bio</Text>
          <TextInput
            style={styles.bioInput}
            value={bio}
            onChangeText={setBio}
            placeholder="Tell us about yourself..."
            multiline
          />
        </View>

        {role === "vet" && (
          <>
            <Text style={styles.label}>Clinic Name</Text>
            <InputField value={clinicName} onChangeText={setClinicName} placeholder="Enter clinic name" error={errors.clinicName} />

            <Text style={styles.label}>Clinic Address</Text>
            <InputField value={clinicAddress} onChangeText={setClinicAddress} placeholder="Enter clinic address" error={errors.clinicAddress} />

            <Text style={styles.label}>License Number</Text>
            <InputField value={licenseNumber} onChangeText={setLicenseNumber} placeholder="Enter license number" error={errors.licenseNumber} />

            <Text style={styles.label}>Years of Experience</Text>
            <InputField value={yearsOfExperience} onChangeText={setYearsOfExperience} placeholder="e.g. 10" error={errors.yearsOfExperience} />

            <Text style={styles.label}>Medical License Document</Text>
            <FileUploadField file={licenseDocument} onPick={handlePickDocument} />
            <Text style={styles.helperText}>Replace license document if needed.</Text>
          </>
        )}

        {role === "ngo" && (
          <>
            <Text style={styles.label}>Verification Document</Text>
            <FileUploadField file={verificationDocument} onPick={handlePickDocument} />
            <Text style={styles.helperText}>Replace verification document if needed.</Text>
          </>
        )}

        {(role === "vet" || role === "ngo") && (
          <>
            <Text style={styles.label}>PayHere Merchant ID</Text>
            <InputField value={merchantId} onChangeText={setMerchantId} placeholder="Enter Merchant ID" />

            <Text style={styles.label}>PayHere Merchant Secret</Text>
            <InputField value={merchantSecret} onChangeText={setMerchantSecret} placeholder="Enter Merchant Secret" secure />

            <View style={[styles.recurringSetupNotice, recurringPaymentsEnabled && styles.recurringEnabledNotice]}>
              <Ionicons
                name={recurringPaymentsEnabled ? "checkmark-circle-outline" : "information-circle-outline"}
                size={21}
                color={recurringPaymentsEnabled ? "#15803D" : "#B45309"}
              />
              <View style={styles.recurringSetupText}>
                <Text style={[styles.recurringSetupTitle, recurringPaymentsEnabled && styles.recurringEnabledTitle]}>
                  {recurringPaymentsEnabled ? "Recurring donations enabled" : "Want to receive recurring donations?"}
                </Text>
                <Text style={styles.recurringSetupDescription}>
                  {recurringPaymentsEnabled
                    ? "Your API credentials are saved securely and are hidden here. Enter both fields below only if you want to replace them."
                    : "Add your PayHere API App ID and App Secret below to enable recurring donation management."}
                </Text>
              </View>
            </View>

            <Text style={styles.label}>PayHere API App ID</Text>
            <InputField value={payHereAppId} onChangeText={setPayHereAppId} placeholder="Enter App ID to enable recurring donations" />

            <Text style={styles.label}>PayHere API App Secret</Text>
            <InputField value={payHereAppSecret} onChangeText={setPayHereAppSecret} placeholder="Enter App Secret" secure />
            <Text style={styles.helperText}>
              Required for donor-controlled recurring cancellation. Leave both blank to keep the existing setup.
            </Text>
            <TouchableOpacity
              style={styles.payHereHelpLink}
              onPress={() => router.push({ pathname: "/profile/HelpSupport", params: { topic: "payhere" } })}
            >
              <Ionicons name="help-circle-outline" size={16} color="#B45309" />
              <Text style={styles.payHereHelpText}>How to get PayHere credentials</Text>
            </TouchableOpacity>
          </>
        )}

        <View style={styles.buttonSection}>
          <PrimaryButton
            title={isSubmitting ? "Saving changes..." : "Save Changes"}
            onPress={handleSaveChanges}
            disabled={isSubmitting}
          />
          <TouchableOpacity style={styles.cancelButton} onPress={() => router.back()}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <ImageViewer
        imageUrl={profileImage}
        visible={isViewerVisible}
        onClose={() => setIsViewerVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FAFAFA" },
  contentContainer: { padding: 20, paddingBottom: 32 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20, marginTop: 10 },
  headerTitle: { fontSize: 20, fontWeight: "700", color: "#222" },
  headerSpacer: { width: 22 },
  imageSection: { alignItems: "center", marginBottom: 22 },
  avatarWrapper: { position: "relative", marginBottom: 10 },
  avatarPlaceholder: { width: 110, height: 110, borderRadius: 55, backgroundColor: "#E7BFA5", justifyContent: "center", alignItems: "center", borderWidth: 3, borderColor: "#fff" },
  avatarImage: { width: 110, height: 110, borderRadius: 55, borderWidth: 3, borderColor: "#fff" },
  cameraIcon: { position: "absolute", right: 4, bottom: 4, width: 28, height: 28, borderRadius: 14, backgroundColor: BRAND_COLOR, justifyContent: "center", alignItems: "center" },
  changePhotoText: { fontSize: 14, color: BRAND_COLOR, fontWeight: "500" },
  bioSection: { marginTop: 8, marginBottom: 14 },
  bioLabel: { fontSize: 13, marginBottom: 6, fontWeight: "500", color: "#333" },
  bioInput: { borderWidth: 1, borderColor: "#ddd", borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16, minHeight: 110, backgroundColor: "#f9f9f9", textAlignVertical: "top", fontSize: 15, color: "#222" },
  label: { fontSize: 13, marginBottom: 6, fontWeight: "500", color: "#333" },
  buttonSection: { marginTop: 18 },
  cancelButton: { marginTop: 8, borderWidth: 1, borderColor: "#DDD", borderRadius: 12, paddingVertical: 14, alignItems: "center", backgroundColor: "#fff" },
  cancelButtonText: { fontSize: 16, fontWeight: "600", color: "#666" },
  helperText: { fontSize: 11, color: "#888", marginTop: -10, marginBottom: 10 },
  recurringSetupNotice: { flexDirection: "row", gap: 10, backgroundColor: "#FFF7E6", borderWidth: 1, borderColor: "#F6DFC0", borderRadius: 12, padding: 12, marginVertical: 12 },
  recurringEnabledNotice: { backgroundColor: "#F0FDF4", borderColor: "#BBF7D0" },
  recurringSetupText: { flex: 1 },
  recurringSetupTitle: { fontSize: 13, fontWeight: "700", color: "#7A4A08", marginBottom: 4 },
  recurringEnabledTitle: { color: "#166534" },
  recurringSetupDescription: { fontSize: 11, lineHeight: 17, color: "#705B3E" },
  payHereHelpLink: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", marginBottom: 12 },
  payHereHelpText: { color: "#B45309", fontSize: 12, fontWeight: "700" },
});
