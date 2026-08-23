import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
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
import { ANIMAL_BREEDS } from "../../constants/breeds.constants";

type AdvancedFilters = {
  animalType: string;
  otherAnimalType: string;
  gender: string;
  breed: string;
  customBreed: string;
  ageRange: string;
  healthStatus: string;
  location: string;
};

const EMPTY_FILTERS: AdvancedFilters = {
  animalType: "",
  otherAnimalType: "",
  gender: "",
  breed: "",
  customBreed: "",
  ageRange: "Any age",
  healthStatus: "",
  location: "",
};

const ANIMAL_TYPES = ["Dog", "Cat", "Other"];
const GENDERS = ["Male", "Female"];
const AGE_RANGES = ["Any age", "Below 6 months", "6–12 months", "1–3 years", "3–7 years", "Above 7 years"];
const HEALTH_STATUSES = ["Healthy", "Needs Care", "Under Treatment", "Special Needs"];

const parseFilters = (serialized?: string): AdvancedFilters => {
  if (!serialized) return EMPTY_FILTERS;
  try {
    return { ...EMPTY_FILTERS, ...JSON.parse(serialized) };
  } catch {
    return EMPTY_FILTERS;
  }
};

export default function AdoptionFilter() {
  const router = useRouter();
  const { filters: filtersParam } = useLocalSearchParams<{ filters?: string | string[] }>();
  const serializedFilters = Array.isArray(filtersParam) ? filtersParam[0] : filtersParam;
  const [filters, setFilters] = useState<AdvancedFilters>(() => parseFilters(serializedFilters));
  const [openFilter, setOpenFilter] = useState<keyof AdvancedFilters | null>(null);

  const availableBreeds = useMemo(() => {
    if (filters.animalType === "Dog") return ANIMAL_BREEDS.Dog.filter((breed) => breed !== "Unknown Breed");
    if (filters.animalType === "Cat") return ANIMAL_BREEDS.Cat.filter((breed) => breed !== "Unknown");
    return [];
  }, [filters.animalType]);

  const filterFields: { key: keyof AdvancedFilters; label: string; options: string[] }[] = [
    { key: "animalType", label: "Animal type", options: ANIMAL_TYPES },
    { key: "gender", label: "Gender", options: GENDERS },
    ...(filters.animalType !== "Other"
      ? [{ key: "breed" as keyof AdvancedFilters, label: "Breed", options: availableBreeds }]
      : []),
    { key: "ageRange", label: "Age", options: AGE_RANGES },
    { key: "healthStatus", label: "Health status", options: HEALTH_STATUSES },
  ];

  const updateSelection = (key: keyof AdvancedFilters, option: string) => {
    setFilters((current) => {
      if (key === "animalType") {
        return { ...current, animalType: option, breed: "", customBreed: "", otherAnimalType: "" };
      }
      if (key === "breed") return { ...current, breed: option, customBreed: "" };
      return { ...current, [key]: option };
    });
    setOpenFilter(null);
  };

  const applyFilters = () => {
    router.replace({
      pathname: "/adoption-corner",
      params: { filters: JSON.stringify(filters) },
    });
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={() => router.back()} activeOpacity={0.8}>
          <Ionicons name="arrow-back" size={22} color="#062425" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Filter Pets</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.intro}>Choose the details that match the pet you are looking for.</Text>

        {filterFields.map(({ key, label, options }) => {
          const breedDisabled = key === "breed" && !filters.animalType;
          return (
            <View key={key} style={styles.filterGroup}>
              <Text style={styles.filterLabel}>{label}</Text>
              <TouchableOpacity
                disabled={breedDisabled}
                style={[styles.filterSelect, breedDisabled && styles.filterSelectDisabled]}
                onPress={() => setOpenFilter((current) => (current === key ? null : key))}
                activeOpacity={0.8}
              >
                <Text style={filters[key] ? styles.filterSelectText : styles.filterPlaceholder}>
                  {filters[key] || (breedDisabled ? "Select animal type first" : `Select ${label.toLowerCase()}`)}
                </Text>
                <Ionicons name={openFilter === key ? "chevron-up" : "chevron-down"} size={18} color="#717878" />
              </TouchableOpacity>

              {openFilter === key && (
                <ScrollView style={styles.dropdown} nestedScrollEnabled>
                  {options.map((option) => (
                    <TouchableOpacity
                      key={option}
                      style={[styles.dropdownItem, filters[key] === option && styles.dropdownItemActive]}
                      onPress={() => updateSelection(key, option)}
                    >
                      <Text style={styles.dropdownText}>{option}</Text>
                      {filters[key] === option && <Ionicons name="checkmark" size={18} color="#D48806" />}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}

              {key === "animalType" && filters.animalType === "Other" && (
                <View style={styles.conditionalField}>
                  <Text style={styles.filterLabel}>Specify animal type</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="e.g. Rabbit, Bird or Turtle"
                    placeholderTextColor="#A8A497"
                    value={filters.otherAnimalType}
                    onChangeText={(otherAnimalType) => setFilters((current) => ({ ...current, otherAnimalType }))}
                  />
                </View>
              )}

              {key === "breed" && filters.breed === "Other" && (
                <View style={styles.conditionalField}>
                  <Text style={styles.filterLabel}>Specify breed</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Type the breed"
                    placeholderTextColor="#A8A497"
                    value={filters.customBreed}
                    onChangeText={(customBreed) => setFilters((current) => ({ ...current, customBreed }))}
                  />
                  {!filters.customBreed.trim() && <Text style={styles.helpText}>Enter a breed to apply this filter.</Text>}
                </View>
              )}
            </View>
          );
        })}

        <View style={styles.filterGroup}>
          <Text style={styles.filterLabel}>Location</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Type a city or area"
            placeholderTextColor="#A8A497"
            value={filters.location}
            onChangeText={(location) => setFilters((current) => ({ ...current, location }))}
          />
        </View>
      </ScrollView>

      <View style={styles.actions}>
        <View style={styles.actionButton}>
          <PrimaryButton title="Clear" variant="outline" onPress={() => { setFilters(EMPTY_FILTERS); setOpenFilter(null); }} />
        </View>
        <View style={styles.actionButton}>
          <PrimaryButton
            title="Apply Filters"
            disabled={filters.breed === "Other" && !filters.customBreed.trim()}
            onPress={applyFilters}
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F8F9FA" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 52,
    paddingBottom: 14,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E2E0D6",
  },
  iconButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#F3F4F5", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 20, fontWeight: "700", color: "#062425" },
  headerSpacer: { width: 40 },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 32, gap: 16 },
  intro: { fontSize: 14, lineHeight: 20, color: "#717878", marginBottom: 2 },
  filterGroup: { gap: 7 },
  filterLabel: { fontSize: 12, fontWeight: "700", color: "#191C1D" },
  filterSelect: { minHeight: 48, borderWidth: 1, borderColor: "#E2E0D6", borderRadius: 12, paddingHorizontal: 14, backgroundColor: "#FFFFFF", flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  filterSelectDisabled: { opacity: 0.55 },
  filterSelectText: { flex: 1, fontSize: 14, color: "#191C1D" },
  filterPlaceholder: { flex: 1, fontSize: 14, color: "#A8A497" },
  dropdown: { maxHeight: 210, borderWidth: 1, borderColor: "#E2E0D6", borderRadius: 12, backgroundColor: "#FFFFFF" },
  dropdownItem: { minHeight: 44, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#E2E0D6" },
  dropdownItemActive: { backgroundColor: "#FFF7E6" },
  dropdownText: { fontSize: 14, color: "#191C1D" },
  conditionalField: { gap: 7, marginTop: 4 },
  textInput: { minHeight: 48, borderWidth: 1, borderColor: "#E2E0D6", borderRadius: 12, paddingHorizontal: 14, backgroundColor: "#FFFFFF", color: "#191C1D", fontSize: 14 },
  helpText: { color: "#B00020", fontSize: 11 },
  actions: { flexDirection: "row", gap: 10, paddingHorizontal: 20, paddingTop: 14, paddingBottom: Platform.OS === "ios" ? 30 : 18, backgroundColor: "#FFFFFF", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#E2E0D6" },
  actionButton: { flex: 1 },
});
