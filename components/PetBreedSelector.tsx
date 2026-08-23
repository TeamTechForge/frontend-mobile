import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { ANIMAL_BREEDS } from "../constants/breeds.constants";

type SupportedAnimalType = "Dog" | "Cat";

type Props = {
  animalType: SupportedAnimalType;
  selectedBreed: string;
  customBreed: string;
  onSelectedBreedChange: (breed: string) => void;
  onCustomBreedChange: (breed: string) => void;
  breedError?: string;
  customBreedError?: string;
  onCustomBreedBlur?: () => void;
};

const breedCache: Partial<Record<SupportedAnimalType, string[]>> = {};
const breedRequests: Partial<Record<SupportedAnimalType, Promise<string[]>>> = {};
const BREED_REQUEST_TIMEOUT_MS = 4000;
const CAT_API_KEY = process.env.EXPO_PUBLIC_CAT_API_KEY?.trim() || "DEMO-API-KEY";

const OFFLINE_BREEDS: Record<SupportedAnimalType, string[]> = {
  Dog: [
    "Akita", "Alaskan Malamute", "Australian Cattle Dog", "Australian Shepherd",
    "Basset Hound", "Belgian Malinois", "Bernese Mountain Dog", "Bichon Frise",
    "Border Collie", "Boston Terrier", "Boxer", "Bull Terrier", "Cane Corso",
    "Cavalier King Charles Spaniel", "Chihuahua", "Chow Chow", "Cocker Spaniel",
    "Collie", "Dachshund", "Dalmatian", "English Springer Spaniel", "Great Dane",
    "Greyhound", "Havanese", "Jack Russell Terrier", "Maltese", "Mastiff",
    "Miniature Schnauzer", "Newfoundland", "Papillon", "Pekingese", "Pomeranian",
    "Portuguese Water Dog", "Pug", "Saint Bernard", "Samoyed", "Shiba Inu",
    "Shih Tzu", "Staffordshire Bull Terrier", "Weimaraner", "Whippet",
  ],
  Cat: [
    "American Bobtail", "American Curl", "American Shorthair", "Balinese", "Birman",
    "Bombay", "British Longhair", "British Shorthair", "Burmese", "Burmilla",
    "Chartreux", "Cornish Rex", "Devon Rex", "Egyptian Mau", "Exotic Shorthair",
    "Himalayan", "Japanese Bobtail", "Korat", "LaPerm", "Maine Coon", "Manx",
    "Munchkin", "Norwegian Forest Cat", "Ocicat", "Oriental Shorthair", "Persian",
    "Ragamuffin", "Ragdoll", "Russian Blue", "Savannah", "Selkirk Rex", "Siamese",
    "Siberian", "Singapura", "Snowshoe", "Somali", "Sphynx", "Tonkinese",
    "Turkish Angora", "Turkish Van",
  ],
};

const titleCase = (value: string) =>
  value.replace(/(^|\s)\S/g, (character) => character.toUpperCase());

const fetchWithTimeout = (url: string, options?: RequestInit): Promise<Response> =>
  Promise.race([
    fetch(url, options),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Breed request timed out")), BREED_REQUEST_TIMEOUT_MS)
    ),
  ]);

const fetchBreedList = async (animalType: SupportedAnimalType): Promise<string[]> => {
  if (breedCache[animalType]) return breedCache[animalType]!;
  if (breedRequests[animalType]) return breedRequests[animalType]!;

  breedRequests[animalType] = (async () => {
    const url =
      animalType === "Dog"
        ? "https://dog.ceo/api/breeds/list/all"
        : "https://api.thecatapi.com/v1/breeds";
    const response = await fetchWithTimeout(
      url,
      animalType === "Cat" ? { headers: { "x-api-key": CAT_API_KEY } } : undefined
    );
    if (!response.ok) throw new Error("Breed list unavailable");
    const data = await response.json();
    let breeds: string[];
    if (animalType === "Dog") {
      const breedMap = data?.message as Record<string, string[]> | undefined;
      if (!breedMap || typeof breedMap !== "object") throw new Error("Invalid breed list");
      breeds = Object.entries(breedMap).flatMap(([breed, subBreeds]) =>
        subBreeds.length
          ? subBreeds.map((subBreed) => titleCase(`${subBreed} ${breed}`))
          : [titleCase(breed)]
      );
    } else {
      breeds = Array.isArray(data)
        ? data.map((breed) => breed?.name).filter((name): name is string => typeof name === "string")
        : [];
    }

    const uniqueBreeds = [...new Set(breeds.map((breed) => breed.trim()).filter(Boolean))].sort();
    if (!uniqueBreeds.length) throw new Error("Empty breed list");
    breedCache[animalType] = uniqueBreeds;
    if (__DEV__) console.info(`[BreedSelector] Using online ${animalType} breeds`);
    return uniqueBreeds;
  })();

  try {
    return await breedRequests[animalType]!;
  } catch {
    const fallbackBreeds = [...new Set([
      ...ANIMAL_BREEDS[animalType].filter((breed) => breed !== "Other"),
      ...OFFLINE_BREEDS[animalType],
    ])].sort();
    breedCache[animalType] = fallbackBreeds;
    if (__DEV__) console.info(`[BreedSelector] Using offline ${animalType} breeds`);
    return fallbackBreeds;
  } finally {
    delete breedRequests[animalType];
  }
};

export default function PetBreedSelector({
  animalType,
  selectedBreed,
  customBreed,
  onSelectedBreedChange,
  onCustomBreedChange,
  breedError,
  customBreedError,
  onCustomBreedBlur,
}: Props) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const requestId = useRef(0);
  const skipNextSearch = useRef(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    requestId.current += 1;
    setDropdownOpen(false);
    setSuggestions([]);
    setIsLoading(false);
    setApiError(false);
    setHasSearched(false);
  }, [animalType]);

  useEffect(() => {
    if (selectedBreed === "Other" && !breedCache[animalType]) {
      void fetchBreedList(animalType).catch(() => undefined);
    }
  }, [animalType, selectedBreed]);

  useEffect(() => {
    if (skipNextSearch.current) {
      skipNextSearch.current = false;
      requestId.current += 1;
      setSuggestions([]);
      setIsLoading(false);
      setHasSearched(false);
      return;
    }

    const query = customBreed.trim().toLowerCase();
    const currentRequest = ++requestId.current;

    if (selectedBreed !== "Other" || query.length < 2) {
      setSuggestions([]);
      setIsLoading(false);
      setApiError(false);
      setHasSearched(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      setApiError(false);
      try {
        const breeds = await fetchBreedList(animalType);
        if (currentRequest !== requestId.current) return;
        setSuggestions(
          breeds.filter((breed) => breed.toLowerCase().includes(query)).slice(0, 5)
        );
        setHasSearched(true);
      } catch {
        if (currentRequest !== requestId.current) return;
        setSuggestions([]);
        setApiError(true);
        setHasSearched(true);
      } finally {
        if (currentRequest === requestId.current) setIsLoading(false);
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [animalType, customBreed, retryCount, selectedBreed]);

  const commonBreeds = ANIMAL_BREEDS[animalType];

  return (
    <View>
      <Text style={styles.label}>BREED <Text style={styles.required}>*</Text></Text>
      <TouchableOpacity
        style={[styles.input, styles.dropdownTrigger, breedError && styles.inputError]}
        onPress={() => setDropdownOpen((open) => !open)}
        activeOpacity={0.8}
      >
        <Text style={selectedBreed ? styles.inputText : styles.placeholder}>
          {selectedBreed || `Select ${animalType.toLowerCase()} breed`}
        </Text>
        <Ionicons
          name={dropdownOpen ? "chevron-up" : "chevron-down"}
          size={18}
          color="#717878"
        />
      </TouchableOpacity>

      {dropdownOpen && (
        <ScrollView style={styles.dropdownList} nestedScrollEnabled>
          {commonBreeds.map((breed) => (
            <TouchableOpacity
              key={breed}
              style={[styles.dropdownItem, selectedBreed === breed && styles.dropdownItemActive]}
              onPress={() => {
                onSelectedBreedChange(breed);
                if (breed !== "Other") onCustomBreedChange("");
                setDropdownOpen(false);
              }}
            >
              <Text
                style={[
                  styles.dropdownItemText,
                  selectedBreed === breed && styles.dropdownItemTextActive,
                ]}
              >
                {breed}
              </Text>
              {selectedBreed === breed && (
                <Ionicons name="checkmark" size={16} color="#D48806" />
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
      {breedError ? <Text style={styles.fieldError}>{breedError}</Text> : null}

      {selectedBreed === "Other" && (
        <View style={styles.customBreedGroup}>
          <Text style={styles.label}>SPECIFY BREED <Text style={styles.required}>*</Text></Text>
          <TextInput
            style={[styles.input, customBreedError && styles.inputError]}
            placeholder="e.g. Mixed breed, Dachshund..."
            placeholderTextColor="#A8A497"
            value={customBreed}
            onChangeText={onCustomBreedChange}
            onBlur={onCustomBreedBlur}
            autoCorrect={false}
          />

          {isLoading && (
            <View style={styles.statusRow}>
              <ActivityIndicator size="small" color="#F5A623" />
              <Text style={styles.statusText}>Finding breeds...</Text>
            </View>
          )}
          {!isLoading && suggestions.length > 0 && (
            <View style={styles.suggestionList}>
              {suggestions.map((suggestion) => (
                <TouchableOpacity
                  key={suggestion}
                  style={styles.suggestionItem}
                  onPress={() => {
                    skipNextSearch.current = true;
                    onCustomBreedChange(suggestion);
                    setSuggestions([]);
                    setHasSearched(false);
                  }}
                >
                  <Text style={styles.suggestionText}>{suggestion}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          {!isLoading && apiError && (
            <View style={styles.errorStatusRow}>
              <Text style={styles.statusText}>Breed suggestions are unavailable. You can still enter the breed.</Text>
              <TouchableOpacity
                onPress={() => {
                  setApiError(false);
                  setRetryCount((count) => count + 1);
                }}
              >
                <Text style={styles.retryText}>Try again</Text>
              </TouchableOpacity>
            </View>
          )}
          {!isLoading && !apiError && hasSearched && suggestions.length === 0 && (
            <Text style={styles.statusText}>No matching breeds. You can keep your entry.</Text>
          )}
          {customBreedError ? <Text style={styles.fieldError}>{customBreedError}</Text> : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 12, fontWeight: "700", color: "#717878", letterSpacing: 0.7, marginBottom: 7 },
  required: { color: "#B00020" },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: "#E2E0D6",
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    color: "#191C1D",
    fontSize: 15,
  },
  inputError: { borderColor: "#B00020" },
  dropdownTrigger: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  inputText: { color: "#191C1D", fontSize: 15 },
  placeholder: { color: "#A8A497", fontSize: 15 },
  dropdownList: {
    maxHeight: 230,
    borderWidth: 1,
    borderColor: "#E2E0D6",
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    marginTop: 6,
  },
  dropdownItem: {
    minHeight: 45,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E2E0D6",
  },
  dropdownItemActive: { backgroundColor: "#FFF7E6" },
  dropdownItemText: { color: "#191C1D", fontSize: 14 },
  dropdownItemTextActive: { color: "#D48806", fontWeight: "600" },
  customBreedGroup: { marginTop: 16 },
  suggestionList: {
    borderWidth: 1,
    borderColor: "#E2E0D6",
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    marginTop: 6,
    overflow: "hidden",
  },
  suggestionItem: { minHeight: 42, paddingHorizontal: 14, justifyContent: "center", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#E2E0D6" },
  suggestionText: { color: "#191C1D", fontSize: 14 },
  statusRow: { flexDirection: "row", alignItems: "center", marginTop: 8, gap: 7 },
  statusText: { color: "#717878", fontSize: 12, marginTop: 7, lineHeight: 17 },
  errorStatusRow: { alignItems: "flex-start" },
  retryText: { color: "#D48806", fontSize: 12, fontWeight: "700", marginTop: 5 },
  fieldError: { color: "#B00020", fontSize: 12, marginTop: 5 },
});
