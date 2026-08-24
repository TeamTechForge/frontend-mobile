import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import PrimaryButton from "../../components/PrimaryButton";
import ChatLocationPicker from "../../components/chat/ChatLocationPicker";
import MapViewWrapper, { Marker } from "../../components/MapViewWrapper";
import { useAuth } from "../../contexts/AuthContext";
import { getPostById, updatePost } from "../../services/adoptionService";
import { ANIMAL_BREEDS, AnimalCategory } from "../../constants/breeds.constants";
import AdoptionLocationSearchInput from "./AdoptionLocationSearchInput";
import PetBreedSelector from "../../components/PetBreedSelector";

// Centralized color tokens matching Lost & Found
const C = {
  bg: "#F8F9FA",
  surface: "#FFFFFF",
  surfaceLow: "#F3F4F5",
  primary: "#F5A623",
  primaryContainer: "#FFF7E6",
  onPrimaryContainer: "#D48806",
  outline: "#E2E0D6",
  textMain: "#191C1D",
  textSub: "#717878",
  textPlaceholder: "#A8A497",
  error: "#B00020",
  errorBg: "#FFF0F0",
  amber: "#F5A623",
  amberDim: "#FFF8E7",
};

type Category = AnimalCategory;
type Gender = "Male" | "Female";
type Status = "Available" | "Pending" | "Adopted";
type HealthStatus = "Healthy" | "Needs Care" | "Under Treatment" | "Special Needs";

const BREEDS_BY_CATEGORY = ANIMAL_BREEDS;

const GENDERS: Gender[] = ["Male", "Female"];
const STATUSES: Status[] = ["Available", "Pending", "Adopted"];
const HEALTH_STATUSES: HealthStatus[] = [
  "Healthy",
  "Needs Care",
  "Under Treatment",
  "Special Needs",
];
const TRAITS = [
  "Vaccinated",
  "Neutered",
  "Microchipped",
  "House trained",
  "Good with kids",
  "Good with pets",
];

type Errors = {
  name?: string;
  age?: string;
  description?: string;
  customCategory?: string;
  breed?: string;
  otherBreed?: string;
  location?: string;
};

export default function EditAdoptionPost() {
  const router = useRouter();
  const { postId } = useLocalSearchParams<{ postId: string }>();
  const { user } = useAuth();

  // ── Loading state ─────────────────────────────────────────────────────────
  const [fetching, setFetching] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // ── Form State ────────────────────────────────────────────────────────────
  const [category, setCategory] = useState<Category>("Dog");
  const [customCategory, setCustomCategory] = useState("");
  const [breed, setBreed] = useState(BREEDS_BY_CATEGORY.Dog[0]);
  const [otherBreed, setOtherBreed] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState<Gender>("Male");
  const [genderDropdownOpen, setGenderDropdownOpen] = useState(false);
  const [name, setName] = useState("");
  const [status, setStatus] = useState<Status>("Available");
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [healthStatus, setHealthStatus] = useState<HealthStatus>("Healthy");
  const [healthDropdownOpen, setHealthDropdownOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [selectedTraits, setSelectedTraits] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [location, setLocation] = useState("");

  // ── Images ────────────────────────────────────────────────────────────────
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [newImages, setNewImages] = useState<string[]>([]);

  // ── UI State ──────────────────────────────────────────────────────────────
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState<{ latitude: number; longitude: number } | null>(null);
  const [descriptionHeight, setDescriptionHeight] = useState(96);
  const [errors, setErrors] = useState<Errors>({});
  const [errorMessage, setErrorMessage] = useState("");

  // ── Fetch Post ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!postId) return;
    getPostById(postId)
      .then((post) => {
        const cat = (post.category as Category) ?? "Dog";
        setCategory(cat);
        setCustomCategory(post.customCategory ?? "");

        if (cat === "Dog" || cat === "Cat") {
          const catBreeds = BREEDS_BY_CATEGORY[cat] || [];
          if (catBreeds.includes(post.breed)) {
            setBreed(post.breed);
            setOtherBreed("");
          } else {
            setBreed("Other");
            setOtherBreed(post.breed || "");
          }
        } else {
          setBreed("Other");
          setOtherBreed(post.breed || "");
        }

        setAge(post.age || "");
        setGender((post.gender as Gender) ?? "Male");
        setName(post.name || "");
        setStatus((post.status as Status) ?? "Available");
        setHealthStatus((post.healthStatus as HealthStatus) ?? "Healthy");
        setDescription(post.description || "");
        setSelectedTraits(post.traits ?? []);
        setNotes(post.notes ?? "");
        setLocation(post.location ?? "");
        if (Number.isFinite(post.latitude) && Number.isFinite(post.longitude)) {
          setSelectedRegion({ latitude: Number(post.latitude), longitude: Number(post.longitude) });
        }
        setExistingImages(post.images ?? []);
      })
      .catch(() => setFetchError("Could not load post for editing."))
      .finally(() => setFetching(false));
  }, [postId]);

  // ── Category Change ───────────────────────────────────────────────────────
  const handleCategoryChange = (cat: Category) => {
    setCategory(cat);
    setBreed("");
    setOtherBreed("");
    setCustomCategory("");
    setErrors((prev) => ({
      ...prev,
      customCategory: undefined,
      breed: undefined,
      otherBreed: undefined,
    }));
  };

  // ── Image Handling ────────────────────────────────────────────────────────
  const handleRemoveExisting = (index: number) => {
    setExistingImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRemoveNew = (index: number) => {
    setNewImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddImage = async () => {
    const totalImages = existingImages.length + newImages.length;
    if (totalImages >= 6) {
      Alert.alert("Limit reached", "You can have at most 6 photos per post.");
      return;
    }

    const { status: permStatus } =
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permStatus !== "granted") {
      Alert.alert("Permission required", "Please allow access to your photo library.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: 6 - totalImages,
    });

    if (!result.canceled) {
      const uris = result.assets.map((a) => a.uri);
      setNewImages((prev) =>
        [...prev, ...uris].slice(0, 6 - existingImages.length)
      );
    }
  };

  const toggleTrait = (trait: string) => {
    setSelectedTraits((prev) =>
      prev.includes(trait) ? prev.filter((t) => t !== trait) : [...prev, trait]
    );
  };

  // ── Validation ────────────────────────────────────────────────────────────
  const validateForm = (): boolean => {
    const newErrors: Errors = {};
    if (!name.trim()) newErrors.name = "Pet name is required.";
    if (age.trim() && !/^\d+(\s*(year|years|month|months|week|weeks))?$/i.test(age.trim())) {
      newErrors.age = "Enter a valid age (e.g. 2 years, 6 months).";
    }
    if (!description.trim()) {
      newErrors.description = "Please add a description.";
    } else if (description.trim().length < 20) {
      newErrors.description = "Description must be at least 20 characters.";
    }
    if (category === "Other") {
      if (!customCategory.trim()) {
        newErrors.customCategory = "Please specify the animal type.";
      }
    } else {
      if (!breed) {
        newErrors.breed = "Please select a breed.";
      } else if (breed === "Other" && !otherBreed.trim()) {
        newErrors.otherBreed = "Please specify the breed.";
      }
    }
    if (!location.trim() || !selectedRegion) newErrors.location = "Select a valid location suggestion or choose a location on the map.";

    setErrors(newErrors);
    const firstErr = Object.values(newErrors).find(Boolean);
    if (firstErr) {
      setErrorMessage(firstErr);
      return false;
    }
    setErrorMessage("");
    return true;
  };

  // ── Submit Update ─────────────────────────────────────────────────────────
  const handleUpdate = async () => {
    if (submitting) return;
    if (!validateForm()) return;

    try {
      setSubmitting(true);
      const finalBreed =
        category === "Other"
          ? customCategory.trim() || "Other"
          : breed === "Other"
          ? otherBreed.trim()
          : breed;

      await updatePost(
        postId!,
        {
          category,
          customCategory: customCategory.trim() || undefined,
          breed: finalBreed,
          age,
          gender,
          name: name.trim(),
          status,
          healthStatus,
          description: description.trim(),
          traits: selectedTraits,
          location: location.trim(),
          latitude: selectedRegion?.latitude,
          longitude: selectedRegion?.longitude,
          posterName: user?.name || "Anonymous",
          contact: user?.phone || user?.email || "N/A",
          notes: notes.trim() || undefined,
        },
        newImages,
        existingImages
      );

      Alert.alert("Updated!", "Your post has been updated successfully.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (err: any) {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message ||
        "Could not update your post. Please check your connection and try again.";
      setErrorMessage(msg);
      Alert.alert("Update Failed", msg);
    } finally {
      setSubmitting(false);
    }
  };

  const FieldLabel = ({ text }: { text: string }) => {
    if (text.endsWith(" *")) {
      const baseText = text.slice(0, -2);
      return (
        <Text style={s.fieldLabel}>
          {baseText.toUpperCase()} <Text style={{ color: C.error }}>*</Text>
        </Text>
      );
    }
    return <Text style={s.fieldLabel}>{text.toUpperCase()}</Text>;
  };

  const FieldError = ({ field }: { field: keyof Errors }) =>
    errors[field] ? <Text style={s.fieldError}>{errors[field]}</Text> : null;

  if (fetching) {
    return (
      <View style={s.centeredState}>
        <ActivityIndicator size="large" color={C.primary} />
        <Text style={s.loadingText}>Loading post details...</Text>
      </View>
    );
  }

  if (fetchError) {
    return (
      <View style={s.centeredState}>
        <Ionicons name="alert-circle-outline" size={48} color={C.textSub} />
        <Text style={s.errorText}>{fetchError}</Text>
        <TouchableOpacity style={s.retryBtn} onPress={() => router.back()}>
          <Text style={s.retryBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const totalImages = existingImages.length + newImages.length;

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === "ios" ? "padding" : "height"}>
    <ScrollView
      style={s.container}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Back Button */}
      <TouchableOpacity style={s.backIconBtn} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={24} color={C.textMain} />
      </TouchableOpacity>

      {/* Page Title */}
      <View style={s.titleBlock}>
        <Text style={s.headerTitle}>Edit Adoption Post</Text>
        <Text style={s.headerSub}>
          Update the details of your pet's adoption profile.
        </Text>
      </View>

      {/* Error Banner */}
      {errorMessage ? (
        <View style={s.errorBanner}>
          <Ionicons name="alert-circle" size={16} color={C.error} />
          <Text style={s.errorBannerText}>{errorMessage}</Text>
        </View>
      ) : null}

      {/* SECTION 1: Animal Details */}
      <View style={s.card}>
        <Text style={s.sectionTitle}>Animal Details</Text>

        {/* Category Chips */}
        <FieldLabel text="Animal Type *" />
        <View style={s.typeRow}>
          {(["Dog", "Cat", "Other"] as Category[]).map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[s.typeBtn, category === cat && s.typeBtnActive]}
              onPress={() => handleCategoryChange(cat)}
              activeOpacity={0.8}
            >
              <Text
                style={[s.typeBtnText, category === cat && s.typeBtnTextActive]}
              >
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Custom Category if "Other" */}
        {category === "Other" && (
          <View style={s.fieldGroup}>
            <FieldLabel text="Specify Animal Type *" />
            <TextInput
              style={[s.input, errors.customCategory && s.inputError]}
              placeholder="e.g. Rabbit, Parrot, Turtle..."
              placeholderTextColor={C.textPlaceholder}
              value={customCategory}
              onChangeText={(v) => {
                setCustomCategory(v);
                if (v.trim())
                  setErrors((prev) => ({ ...prev, customCategory: undefined }));
              }}
            />
            <FieldError field="customCategory" />
          </View>
        )}

        {/* Reusable breed selector - only for Dog or Cat */}
        {(category === "Dog" || category === "Cat") && (
          <View style={s.fieldGroup}>
            <PetBreedSelector
              animalType={category}
              selectedBreed={breed}
              customBreed={otherBreed}
              onSelectedBreedChange={(value) => {
                setBreed(value);
                setErrors((prev) => ({ ...prev, breed: undefined }));
              }}
              onCustomBreedChange={(value) => {
                setOtherBreed(value);
                if (value.trim()) setErrors((prev) => ({ ...prev, otherBreed: undefined }));
              }}
              breedError={errors.breed}
              customBreedError={errors.otherBreed}
            />
          </View>
        )}

        {/* Pet Name & Age */}
        <View style={s.rowFields}>
          <View style={{ flex: 1 }}>
            <FieldLabel text="Pet's Name *" />
            <TextInput
              style={[s.input, errors.name && s.inputError]}
              placeholder="e.g. Buddy"
              placeholderTextColor={C.textPlaceholder}
              value={name}
              onChangeText={(v) => {
                setName(v);
                if (v.trim())
                  setErrors((prev) => ({ ...prev, name: undefined }));
              }}
            />
            <FieldError field="name" />
          </View>

          <View style={{ flex: 1, marginLeft: 12 }}>
            <FieldLabel text="Age" />
            <TextInput
              style={[s.input, errors.age && s.inputError]}
              placeholder="e.g. 2 years (optional)"
              placeholderTextColor={C.textPlaceholder}
              value={age}
              onChangeText={(v) => {
                setAge(v);
                if (v.trim())
                  setErrors((prev) => ({ ...prev, age: undefined }));
              }}
            />
            <FieldError field="age" />
          </View>
        </View>

        {/* Gender & Status */}
        <View style={s.rowFields}>
          {/* Gender */}
          <View style={{ flex: 1 }}>
            <FieldLabel text="Gender" />
            <TouchableOpacity
              style={[s.input, s.dropdownTrigger]}
              onPress={() => {
                setGenderDropdownOpen((p) => !p);
                setStatusDropdownOpen(false);
                setHealthDropdownOpen(false);
              }}
              activeOpacity={0.8}
            >
              <Text style={s.inputText}>{gender}</Text>
              <Ionicons
                name={genderDropdownOpen ? "chevron-up" : "chevron-down"}
                size={18}
                color={C.textSub}
              />
            </TouchableOpacity>
            {genderDropdownOpen && (
              <View style={s.dropdownList}>
                {GENDERS.map((g) => (
                  <TouchableOpacity
                    key={g}
                    style={[
                      s.dropdownItem,
                      gender === g && s.dropdownItemActive,
                    ]}
                    onPress={() => {
                      setGender(g);
                      setGenderDropdownOpen(false);
                    }}
                  >
                    <Text
                      style={[
                        s.dropdownItemText,
                        gender === g && s.dropdownItemTextActive,
                      ]}
                    >
                      {g}
                    </Text>
                    {gender === g && (
                      <Ionicons
                        name="checkmark"
                        size={16}
                        color={C.onPrimaryContainer}
                      />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Status */}
          <View style={{ flex: 1, marginLeft: 12 }}>
            <FieldLabel text="Status" />
            <TouchableOpacity
              style={[s.input, s.dropdownTrigger]}
              onPress={() => {
                setStatusDropdownOpen((p) => !p);
                setGenderDropdownOpen(false);
                setHealthDropdownOpen(false);
              }}
              activeOpacity={0.8}
            >
              <Text style={s.inputText}>{status}</Text>
              <Ionicons
                name={statusDropdownOpen ? "chevron-up" : "chevron-down"}
                size={18}
                color={C.textSub}
              />
            </TouchableOpacity>
            {statusDropdownOpen && (
              <View style={s.dropdownList}>
                {STATUSES.map((st) => (
                  <TouchableOpacity
                    key={st}
                    style={[
                      s.dropdownItem,
                      status === st && s.dropdownItemActive,
                    ]}
                    onPress={() => {
                      setStatus(st);
                      setStatusDropdownOpen(false);
                    }}
                  >
                    <Text
                      style={[
                        s.dropdownItemText,
                        status === st && s.dropdownItemTextActive,
                      ]}
                    >
                      {st}
                    </Text>
                    {status === st && (
                      <Ionicons
                        name="checkmark"
                        size={16}
                        color={C.onPrimaryContainer}
                      />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </View>

        {/* Health Status */}
        <View style={s.fieldGroup}>
          <FieldLabel text="Health Status" />
          <TouchableOpacity
            style={[s.input, s.dropdownTrigger]}
            onPress={() => {
              setHealthDropdownOpen((p) => !p);
              setGenderDropdownOpen(false);
              setStatusDropdownOpen(false);
            }}
            activeOpacity={0.8}
          >
            <Text style={s.inputText}>{healthStatus}</Text>
            <Ionicons
              name={healthDropdownOpen ? "chevron-up" : "chevron-down"}
              size={18}
              color={C.textSub}
            />
          </TouchableOpacity>
          {healthDropdownOpen && (
            <View style={s.dropdownList}>
              {HEALTH_STATUSES.map((hs) => (
                <TouchableOpacity
                  key={hs}
                  style={[
                    s.dropdownItem,
                    healthStatus === hs && s.dropdownItemActive,
                  ]}
                  onPress={() => {
                    setHealthStatus(hs);
                    setHealthDropdownOpen(false);
                  }}
                >
                  <Text
                    style={[
                      s.dropdownItemText,
                      healthStatus === hs && s.dropdownItemTextActive,
                    ]}
                  >
                    {hs}
                  </Text>
                  {healthStatus === hs && (
                    <Ionicons
                      name="checkmark"
                      size={16}
                      color={C.onPrimaryContainer}
                    />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Description */}
        <View style={s.fieldGroup}>
          <FieldLabel text="Description *" />
          <TextInput
            style={[s.input, s.textArea, { height: descriptionHeight }, errors.description && s.inputError]}
            placeholder="Describe your pet's personality, habits, and needs..."
            placeholderTextColor={C.textPlaceholder}
            multiline
            scrollEnabled={descriptionHeight >= 180}
            onContentSizeChange={(event) => setDescriptionHeight(Math.min(180, Math.max(96, event.nativeEvent.contentSize.height + 24)))}
            textAlignVertical="top"
            value={description}
            onChangeText={(v) => {
              setDescription(v);
              if (v.trim().length >= 20)
                setErrors((prev) => ({ ...prev, description: undefined }));
            }}
          />
          <Text style={{ fontSize: 11, color: C.textSub, marginTop: 4 }}>
            Minimum 20 characters required ({description.length}/20)
          </Text>
          <FieldError field="description" />
        </View>
      </View>

      {/* SECTION 2: Photos */}
      <View style={s.card}>
        <View style={s.cardHeaderRow}>
          <Text style={s.sectionTitle}>Photos *</Text>
          <Text style={s.photoCount}>{totalImages}/6</Text>
        </View>

        <View style={s.imageGrid}>
          {/* Existing Images (Cloudinary) */}
          {existingImages.map((uri, index) => (
            <View key={`existing-${index}`} style={s.imagePreviewWrapper}>
              <Image source={{ uri }} style={s.imagePreview} />
              <TouchableOpacity
                style={s.removeImageBtn}
                onPress={() => handleRemoveExisting(index)}
                activeOpacity={0.8}
              >
                <Ionicons name="close" size={14} color="#fff" />
              </TouchableOpacity>
              {index === 0 && (
                <View style={s.mainBadge}>
                  <Text style={s.mainBadgeText}>Main</Text>
                </View>
              )}
            </View>
          ))}

          {/* Newly Picked Local Images */}
          {newImages.map((uri, index) => (
            <View key={`new-${index}`} style={s.imagePreviewWrapper}>
              <Image source={{ uri }} style={s.imagePreview} />
              <TouchableOpacity
                style={s.removeImageBtn}
                onPress={() => handleRemoveNew(index)}
                activeOpacity={0.8}
              >
                <Ionicons name="close" size={14} color="#fff" />
              </TouchableOpacity>
            </View>
          ))}

          {totalImages < 6 && (
            <TouchableOpacity
              style={s.addMoreBox}
              onPress={handleAddImage}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={26} color={C.amber} />
              <Text style={s.addMoreText}>Add Photo</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* SECTION 3: Traits */}
      <View style={s.card}>
        <Text style={s.sectionTitle}>Traits</Text>
        <Text style={s.sectionSubtitle}>Select all that apply to your pet</Text>
        <View style={s.traitsWrap}>
          {TRAITS.map((trait) => {
            const active = selectedTraits.includes(trait);
            return (
              <TouchableOpacity
                key={trait}
                style={[s.traitChip, active && s.traitChipActive]}
                onPress={() => toggleTrait(trait)}
                activeOpacity={0.8}
              >
                <Text
                  style={[s.traitText, active && s.traitTextActive]}
                >
                  {trait}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* SECTION 4: Location */}
      <View style={s.card}>
        <Text style={s.sectionTitle}>Location</Text>
        <Text style={s.sectionSubtitle}>Select location on map or search for your address</Text>
        <TouchableOpacity style={s.mapBox} onPress={() => setShowLocationPicker(true)} activeOpacity={0.85}>
          {selectedRegion ? (
            <View style={s.mapPreview}>
              <MapViewWrapper style={s.mapPreview} region={{ ...selectedRegion, latitudeDelta: 0.01, longitudeDelta: 0.01 }} scrollEnabled={false} zoomEnabled={false} pitchEnabled={false} rotateEnabled={false}>
                <Marker coordinate={selectedRegion} />
              </MapViewWrapper>
            </View>
          ) : <><View style={s.mapIconCircle}><Ionicons name="location-outline" size={28} color={C.amber} /></View><Text style={s.mapTitle}>Select Location</Text><Text style={s.mapText}>Tap here to select location</Text></>}
        </TouchableOpacity>
        <View style={s.fieldGroup}>
          <FieldLabel text="Adoption Location *" />
          <AdoptionLocationSearchInput
            value={location}
            hasError={Boolean(errors.location)}
            hasValidCoordinates={Boolean(selectedRegion)}
            onTextChange={(text) => { setLocation(text); setSelectedRegion(null); }}
            onPlaceSelected={(description, coordinates) => { setLocation(description); setSelectedRegion(coordinates); setErrors((prev) => ({ ...prev, location: undefined })); }}
          />
          <FieldError field="location" />
        </View>
        <ChatLocationPicker visible={showLocationPicker} onCancel={() => setShowLocationPicker(false)} onSelect={({ address, latitude, longitude }) => { if (address) setLocation(address); setSelectedRegion({ latitude, longitude }); setErrors((prev) => ({ ...prev, location: undefined })); setShowLocationPicker(false); }} />
      </View>

      {/* SECTION 5: Action Buttons */}
      <View style={[s.actions, { alignItems: "center" }]}>
        <View style={{ flex: 1 }}>
          <PrimaryButton
            title="Cancel"
            variant="outline"
            onPress={() => router.back()}
            disabled={submitting}
          />
        </View>
        <View style={{ flex: 2, marginLeft: 12 }}>
          <PrimaryButton
            title={submitting ? "Saving…" : "Save Changes"}
            onPress={handleUpdate}
            disabled={submitting}
          />
        </View>
      </View>

      {/* Bottom spacer */}
      <View style={{ height: 40 }} />
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },
  centeredState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.bg,
    padding: 24,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: C.textSub,
  },
  errorText: {
    fontSize: 15,
    color: C.textSub,
    textAlign: "center",
  },
  retryBtn: {
    marginTop: 8,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: C.primary,
  },
  retryBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },

  backIconBtn: {
    paddingHorizontal: 16,
    paddingTop: 52,
    paddingBottom: 4,
    alignSelf: "flex-start",
  },
  titleBlock: {
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: C.textMain,
    letterSpacing: -0.4,
    marginBottom: 6,
  },
  headerSub: {
    fontSize: 14,
    color: C.textSub,
    lineHeight: 20,
  },

  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
    backgroundColor: C.errorBg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  errorBannerText: {
    color: C.error,
    fontSize: 13,
    flex: 1,
  },

  card: {
    backgroundColor: C.surface,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    padding: 18,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: C.textMain,
    marginBottom: 12,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: C.textSub,
    marginTop: -8,
    marginBottom: 14,
  },

  fieldGroup: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    color: C.textSub,
    marginBottom: 6,
  },
  fieldError: {
    color: C.error,
    fontSize: 12,
    marginTop: 4,
  },

  rowFields: {
    flexDirection: "row",
    marginBottom: 14,
  },

  typeRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  typeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: C.surfaceLow,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  typeBtnActive: {
    backgroundColor: "#FFF0D4",
    borderColor: C.primary,
  },
  typeBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: C.textSub,
  },
  typeBtnTextActive: {
    color: C.onPrimaryContainer,
  },

  input: {
    height: 48,
    borderWidth: 1.5,
    borderColor: C.outline,
    borderRadius: 10,
    paddingHorizontal: 14,
    backgroundColor: C.surfaceLow,
    fontSize: 14,
    color: C.textMain,
    justifyContent: "center",
  },
  inputError: {
    borderColor: C.error,
    backgroundColor: "#FFF8F8",
  },
  inputText: {
    color: C.textMain,
    fontSize: 14,
  },
  placeholder: {
    color: C.textPlaceholder,
    fontSize: 14,
  },
  textArea: {
    minHeight: 96,
    maxHeight: 180,
    paddingTop: 13,
  },

  inputIconWrapper: {
    position: "relative",
  },
  inputIcon: {
    position: "absolute",
    left: 13,
    top: 14,
    zIndex: 1,
  },
  inputWithIcon: {
    paddingLeft: 38,
  },

  dropdownTrigger: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dropdownList: {
    marginTop: 4,
    borderWidth: 1.5,
    borderColor: C.outline,
    borderRadius: 10,
    backgroundColor: C.surface,
    overflow: "hidden",
    maxHeight: 220,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
    zIndex: 10,
  },
  dropdownItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.surfaceLow,
  },
  dropdownItemActive: {
    backgroundColor: C.primaryContainer,
  },
  dropdownItemText: {
    fontSize: 14,
    color: C.textMain,
  },
  dropdownItemTextActive: {
    fontWeight: "700",
    color: C.onPrimaryContainer,
  },

  // Photos
  photoCount: {
    fontSize: 12,
    fontWeight: "600",
    color: C.textSub,
  },
  imageGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  imagePreviewWrapper: {
    width: 96,
    height: 96,
    borderRadius: 10,
    overflow: "hidden",
    position: "relative",
  },
  imagePreview: {
    width: "100%",
    height: "100%",
    borderRadius: 10,
    backgroundColor: C.surfaceLow,
  },
  removeImageBtn: {
    position: "absolute",
    top: 6,
    right: 6,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 99,
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  mainBadge: {
    position: "absolute",
    bottom: 4,
    left: 4,
    backgroundColor: C.primary,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  mainBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#fff",
  },
  addMoreBox: {
    width: 96,
    height: 96,
    borderRadius: 10,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: C.outline,
    backgroundColor: C.amberDim,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  addMoreText: {
    fontSize: 11,
    fontWeight: "600",
    color: C.amber,
  },

  // Traits
  traitsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  traitChip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: C.surfaceLow,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  traitChipActive: {
    backgroundColor: "#FFF0D4",
    borderColor: C.primary,
  },
  traitText: {
    fontSize: 13,
    fontWeight: "600",
    color: C.textSub,
  },
  traitTextActive: {
    color: C.onPrimaryContainer,
  },

  // Location
  mapBox: {
    minHeight: 150,
    borderRadius: 14,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: C.outline,
    backgroundColor: C.amberDim,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    overflow: "hidden",
    marginBottom: 16,
  },
  mapPreview: { width: "100%", height: 150 },
  mapIconCircle: { width: 52, height: 52, borderRadius: 26, backgroundColor: "#FFF3DC", alignItems: "center", justifyContent: "center", marginBottom: 4 },
  mapTitle: { fontSize: 14, fontWeight: "700", color: C.textMain },
  mapText: {
    fontSize: 13,
    fontWeight: "600",
    color: C.textSub,
  },

  // Actions
  actions: {
    flexDirection: "row",
    paddingHorizontal: 16,
    marginTop: 8,
    marginBottom: 16,
  },
});
