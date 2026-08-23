import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { API_URL } from "../../constants/config.constants";
import { useNotification } from "../../contexts/NotificationContext";

const BRAND_COLOR = "#F5A623";

// Show the main landing screen with personalized data for the logged-in user.
export default function HomeScreen() {
  const router = useRouter();
  const { unreadCount, fetchNotifications } = useNotification();
  const [user, setUser] = useState<any>(null);

  // Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Debouncing effect
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch search results
  useEffect(() => {
    const performSearch = async () => {
      if (!debouncedQuery.trim()) {
        setSearchResults([]);
        return;
      }

      setSearchLoading(true);
      try {
        // Retrieve the user's JWT from secure device storage.
        const token = await SecureStore.getItemAsync("authToken");
        // Send the search query to the backend search endpoint.
        const res = await fetch(`${API_URL}/search?q=${encodeURIComponent(debouncedQuery)}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data as any[]);
        }
      } catch (err) {
        console.error("Search fetch error:", err);
      } finally {
        setSearchLoading(false);
      }
    };

    performSearch();
  }, [debouncedQuery]);

  // Fetch notifications on mount
  useEffect(() => {
    fetchNotifications();
  }, []);

  // Loads user profile data
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const token = await SecureStore.getItemAsync("authToken");
        if (!token) return;

        // Validates the session with the backend and retrieves the latest user profile information.
        const response = await fetch(`${API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        if (response.ok) {
          // Updates the UI with user-specific details.
          setUser(data);
        }
      } catch (error) {
        console.error("Home fetch user error:", error);
      }
    };
    fetchUser();
  }, []);

  return (
    <View style={styles.container}>
      {/* Header containing the StrayCare logo and notification button. */}
      <View style={styles.header}>
        <Image
          source={require("../../assets/images/straycarelogo.png")}
          style={styles.logo}
        />

        <TouchableOpacity
          style={styles.notificationIcon}
          onPress={() => router.push("/modals/Notifications" as any)}
        >
          <Ionicons name="notifications-outline" size={24} color="#000" />
          {/* Show a red indicator when unread notifications exist. */}
          {unreadCount > 0 && <View style={styles.badgeDot} />}
        </TouchableOpacity>
      </View>

      {/* Personalized greeting using the NGO name when available. */}
      <Text style={styles.greeting}>
        Hello, {user?.organizationName || user?.name || "User"} 👋{"\n"}
        <Text style={styles.greetingSub}>
          Together we can save more stray animals 🐾
        </Text>
      </Text>

      {/* ABOUT CARD */}
      <View style={styles.aboutCard}>
        <Text style={styles.aboutTitle}>About Us</Text>
        <View style={styles.aboutBox}>
          <Text style={styles.aboutText}>
            StrayCare is a mobile platform dedicated to rescuing, caring for,
            and finding homes for street animals in your area.
          </Text>
        </View>
      </View>

      {/* Search area for finding verified NGOs, shelters, and veterinarians. */}
      <View style={[{ zIndex: 10, position: "relative" }, searchQuery.trim().length > 0 && { flex: 1 }]}>
        <View style={styles.searchBar}>
          <Feather name="search" size={18} color="#747272ff" />
          <TextInput
            placeholder="Search for Vets/Shelters by name or location..."
            placeholderTextColor="#9CA3AF"
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
          {/* Clear the search field and remove current results. */}
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => { setSearchQuery(""); setSearchResults([]); }}>
              <Feather name="x" size={18} color="#7b7a7aff" />
            </TouchableOpacity>
          )}
        </View>

        {/* Display search results in an overlay below the search bar. */}
        {searchQuery.trim().length > 0 && (
          <View style={styles.searchDropdown}>
            {searchLoading ? (
              <ActivityIndicator size="small" color={BRAND_COLOR} style={{ padding: 20 }} />
            ) : searchResults.length === 0 ? (
              // Display a message when no matching profiles are found.
              <Text style={styles.noResultsText}>No verified NGOs, Shelters, or Veterinarians found.</Text>
            ) : (
              // Display the profiles returned by the backend.
              <FlatList
                data={searchResults}
                keyExtractor={(item, index) => item.userId + index}
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingBottom: 20 }}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.searchItem}
                    onPress={() => {
                      // Clear search state before opening the profile.
                      setSearchQuery("");
                      setSearchResults([]);
                      // Navigate to the selected user's profile.
                      router.push(`/profile/${item.userId}`);
                    }}
                  >
                    <Image
                      source={
                        item.profileImage
                          ? { uri: item.profileImage }
                          : require("../../assets/images/default-avatar.jpg")
                      }
                      style={styles.searchItemImage}
                    />

                    <View style={styles.searchItemDetails}>
                      <View style={styles.searchItemHeader}>
                        <Text style={styles.searchItemName} numberOfLines={1}>
                          {item.name}
                        </Text>
                        {/* Indicates that the returned profile is verified. */}
                        <Ionicons name="checkmark-circle" size={14} color="#4A90E2" style={{ marginLeft: 4 }} />
                      </View>

                      {/* Display the clinic name and specialization if available. */}
                      {(item.clinicName || item.specialization) && (
                        <View style={styles.tagsContainer}>
                          {item.clinicName && (
                            <View style={styles.tagBadge}>
                              <Ionicons name="business-outline" size={12} color="#4B5563" />
                              <Text style={styles.tagText} numberOfLines={1}>
                                {item.clinicName}
                              </Text>
                            </View>
                          )}
                          {item.specialization && (
                            <View style={[styles.tagBadge, { backgroundColor: "#F3E8FF" }]}>
                              <Ionicons name="medkit-outline" size={12} color="#7E22CE" />
                              <Text style={[styles.tagText, { color: "#7E22CE" }]} numberOfLines={1}>
                                {item.specialization}
                              </Text>
                            </View>
                          )}
                        </View>
                      )}

                      <Text style={styles.searchItemLocation} numberOfLines={1}>
                        📍 {item.location}
                      </Text>

                      {item.bio ? (
                        <Text style={styles.searchItemBio} numberOfLines={1}>
                          {item.bio}
                        </Text>
                      ) : null}
                    </View>

                    {/* Display the profile type as either Animal Shelter or Veterinarian. */}
                    <View style={[
                      styles.typeBadge,
                      { backgroundColor: (item.type === "NGO" || item.type === "Animal Shelter") ? "#EFF6FF" : "#ECFDF5" }
                    ]}>
                      <Text style={[
                        styles.typeBadgeText,
                        { color: (item.type === "NGO" || item.type === "Animal Shelter") ? "#3B82F6" : "#10B981" }
                      ]}>
                        {(item.type === "NGO" || item.type === "Animal Shelter") ? "ANIMAL SHELTER" : "VETERINARIAN"}
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        )}
      </View>

      {/* Quick actions are hidden while the user is actively searching. */}
      {searchQuery.trim().length === 0 && (
        <>
          <Text style={styles.sectionTitle}>Quick Actions</Text>

          <View style={styles.grid}>
            <ActionCard
              icon={<MaterialCommunityIcons name="hand-heart" size={24} color="#F5A623" />}
              label="Donate"
              onPress={() => router.push("/Donate")}
            />

            <ActionCard
              icon={<MaterialCommunityIcons name="dog" size={24} color="#F5A623" />}
              label="Report a Case"
              onPress={() => router.push("/reporting/AnimalDetails")}
            />

            <ActionCard
              icon={<MaterialCommunityIcons name="paw" size={24} color="#F5A623" />}
              label="Adopt a Pet"
              onPress={() => router.push("/adoption-corner" as any)}
            />

            <ActionCard
              icon={<Feather name="search" size={24} color="#F5A623" />}
              label="Lost & Found"
              onPress={() => router.push("/lost-and-found")}
            />
          </View>
        </>
      )}
    </View>
  );
}

// Reusable card component to keep quick action buttons .
function ActionCard({ icon, label, onPress }: any) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <View style={styles.iconCircle}>{icon}</View>
      <Text style={styles.cardText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F4F4F4",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 60,
  },
  header: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
    position: "relative",
  },
  notificationIcon: {
    position: "absolute",
    right: 0,
  },
  badgeDot: {
    position: "absolute",
    top: -2,
    right: -2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#f44336",
    borderWidth: 1.5,
    borderColor: "#F4F4F4",
  },
  logo: {
    width: 150,
    height: 150,
    resizeMode: "contain",
  },
  greeting: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 20,
  },
  greetingSub: {
    fontWeight: "400",
  },
  aboutCard: {
    marginBottom: 20,
  },
  aboutTitle: {
    fontWeight: "600",
    marginBottom: 8,
  },
  aboutBox: {
    backgroundColor: "#EED7B5",
    padding: 15,
    borderRadius: 10,
  },
  aboutText: {
    fontSize: 13,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E5E5E5",
    paddingHorizontal: 12,
    borderRadius: 25,
    height: 45,
    marginBottom: 20,
  },
  searchInput: {
    marginLeft: 8,
    flex: 1,
  },
  searchDropdown: {
    flex: 1,
    marginTop: 10,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E5E5",
    padding: 10,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  searchItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  searchItemImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
  },
  searchItemDetails: {
    flex: 1,
    justifyContent: "center",
  },
  searchItemHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  searchItemName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1F2937",
    maxWidth: "85%",
  },
  searchItemClinic: {
    fontSize: 11,
    color: "#4B5563",
    marginTop: 2,
  },
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 4,
  },
  tagBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
    maxWidth: "100%",
  },
  tagText: {
    fontSize: 10,
    fontWeight: "500",
    color: "#4B5563",
    flexShrink: 1,
  },
  searchItemLocation: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 2,
  },
  searchItemBio: {
    fontSize: 10,
    color: "#9CA3AF",
    marginTop: 2,
  },
  typeBadge: {
    backgroundColor: "#FFF4E6",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#F5A623",
  },
  noResultsText: {
    padding: 20,
    textAlign: "center",
    color: "#6B7280",
    fontSize: 13,
  },
  sectionTitle: {
    fontWeight: "600",
    marginBottom: 15,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  card: {
    width: "48%",
    backgroundColor: "#FFFFFF",
    paddingVertical: 20,
    borderRadius: 16,
    alignItems: "center",
    marginBottom: 15,
    elevation: 2,
  },
  iconCircle: {
    width: 45,
    height: 45,
    borderRadius: 22,
    backgroundColor: "#FFF4E6",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  cardText: {
    fontSize: 13,
    fontWeight: "500",
  },
});
