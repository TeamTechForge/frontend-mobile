import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Dimensions,
  FlatList,
  Image,
  Linking,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getPostById, Post } from "../../services/adoptionService";
import { useAuth } from "../../contexts/AuthContext";
import { useCall } from "../../contexts/CallContext";
import { useChatApi } from "../../hooks/useChatApi";
import OwnerActionButtons from "../../components/OwnerActionButtons";
import { DeleteConfirmModal } from "./DeleteAdoptionPost";

// ─── Paging Dots ──────────────────────────────────────────────────────────────

function PagingDots({ total, active }: { total: number; active: number }) {
  return (
    <View style={styles.dotsRow}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[styles.dot, i === active ? styles.dotActive : styles.dotInactive]}
        />
      ))}
    </View>
  );
}

// ─── Info Chip ────────────────────────────────────────────────────────────────

function InfoChip({
  icon,
  label,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
}) {
  return (
    <View style={styles.chip}>
      <MaterialIcons name={icon} size={20} color="#F5A623" />
      <Text style={styles.chipLabel}>{label}</Text>
    </View>
  );
}

// ─── Status Badge Colors Helper ───────────────────────────────────────────────

const getStatusConfig = (status: string) => {
  switch (status) {
    case "Available":
      return {
        bg: "#E8F5E9",
        color: "#2E7D32",
        icon: "check-circle" as keyof typeof MaterialIcons.glyphMap,
      };
    case "Adopted":
      return {
        bg: "#E0F2FE",
        color: "#0284C7",
        icon: "favorite" as keyof typeof MaterialIcons.glyphMap,
      };
    case "Pending":
    default:
      return {
        bg: "#FFF7E6",
        color: "#D48806",
        icon: "schedule" as keyof typeof MaterialIcons.glyphMap,
      };
  }
};

const getHealthStatusColors = (healthStatus: Post["healthStatus"]) => {
  switch (healthStatus) {
    case "Healthy": return { backgroundColor: "#E8F5E9", color: "#2E7D32" };
    case "Needs Care": return { backgroundColor: "#FFF3E0", color: "#E65100" };
    case "Under Treatment": return { backgroundColor: "#E3F2FD", color: "#1565C0" };
    case "Special Needs": return { backgroundColor: "#F3E5F5", color: "#7B1FA2" };
    default: return { backgroundColor: "#F3F4F5", color: "#191C1D" };
  }
};

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function ViewAdoptionPost() {
  const router = useRouter();
  const { user } = useAuth();
  const { startCall } = useCall();
  const { createConversation } = useChatApi();
  const { postId } = useLocalSearchParams<{ postId: string }>();

  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeImage, setActiveImage] = useState(0);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [viewerVisible, setViewerVisible] = useState(false);

  // ── Fetch post from backend with auto-reload on focus ─────────────────────

  const fetchPost = useCallback(
    async (isRefresh = false) => {
      if (!postId) {
        setError("Post not found.");
        setLoading(false);
        return;
      }
      if (isRefresh) {
        setRefreshing(true);
      }
      try {
        const data = await getPostById(postId);
        setPost(data);
        setError(null);
      } catch (_err) {
        if (!post) {
          setError("Could not load post. Please try again.");
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [postId]
  );

  useFocusEffect(
    useCallback(() => {
      fetchPost();
    }, [fetchPost])
  );

  useEffect(() => {
    if (!viewerVisible) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      setViewerVisible(false);
      return true;
    });
    return () => subscription.remove();
  }, [viewerVisible]);

  // ── Loading state ─────────────────────────────────────────────────────────

  if (loading && !post) {
    return (
      <View style={styles.centeredState}>
        <ActivityIndicator size="large" color="#F5A623" />
        <Text style={styles.loadingText}>Loading post...</Text>
      </View>
    );
  }

  // ── Error state ───────────────────────────────────────────────────────────

  if ((error && !post) || !post) {
    return (
      <View style={styles.centeredState}>
        <MaterialIcons name="error-outline" size={48} color="#717878" />
        <Text style={styles.errorText}>{error ?? "Something went wrong."}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => router.back()}>
          <Text style={styles.retryText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Check if the current user is the owner / caretaker of the post
  const isOwner =
    !!user?._id &&
    (user._id === post.userId?._id || user._id === (post.userId as any));

  const statusCfg = getStatusConfig(post.status);
  const healthColors = getHealthStatusColors(post.healthStatus);

  // ── Build info chips ──────────────────────────────────────────────────────

  const chips: { icon: keyof typeof MaterialIcons.glyphMap; label: string }[] = [
    { icon: post.gender === "Male" ? "male" : "female", label: post.gender },
    ...(post.age ? [{ icon: "cake" as keyof typeof MaterialIcons.glyphMap, label: post.age }] : []),
    { icon: "pets", label: post.category },
  ];

  const traits = (post.traits || []).map((label) => ({
    label,
    verified: true,
  }));

  // ── Call Handler ──────────────────────────────────────────────────────────
  const handleCall = () => {
    if (!post) return;
    const rawUserId = post.userId;
    const ownerId =
      typeof rawUserId === "object" && rawUserId !== null
        ? rawUserId._id
        : (rawUserId || (post as any).ownerId);

    if (ownerId && typeof startCall === "function") {
      startCall(
        String(ownerId),
        post.posterName || (typeof rawUserId === "object" ? rawUserId?.name : "") || "Caretaker",
        typeof rawUserId === "object" ? rawUserId?.avatar || undefined : undefined
      );
      return;
    }

    const phone =
      (typeof rawUserId === "object" ? rawUserId?.phone : "") || post.contact;
    if (phone && phone !== "N/A") {
      Linking.openURL(`tel:${phone}`);
    } else {
      Alert.alert("Contact Unavailable", "No contact details available for this post.");
    }
  };

  // ── Message Handler ───────────────────────────────────────────────────────
  const handleMessage = async () => {
    if (!post) return;
    const rawUserId = post.userId;
    const ownerId =
      typeof rawUserId === "object" && rawUserId !== null
        ? rawUserId._id
        : (rawUserId || (post as any).ownerId);

    if (!ownerId) {
      Alert.alert("Contact Unavailable", "User ID is not available for this post.");
      return;
    }
    if (user?._id === ownerId) {
      Alert.alert("Error", "You cannot message yourself.");
      return;
    }

    try {
      const conversation = (await createConversation(
        String(ownerId), 
        "adoption", 
        { kind: "AdoptionPost", item: post._id }
      )) as any;
      const otherParticipant = conversation.participants?.find(
        (p: any) => p._id !== user?._id
      );

      router.push({
        pathname: "/chat/[conversationId]",
        params: {
          conversationId: conversation._id,
          recipientName:
            otherParticipant?.name || post.posterName || "Caretaker",
          recipientId: String(ownerId),
          recipientImage:
            otherParticipant?.profileImage ||
            (typeof rawUserId === "object" ? rawUserId.avatar : ""),
        },
      });
    } catch (err: any) {
      Alert.alert("Could Not Start Chat", err?.message || "Something went wrong.");
    }
  };

  // ── Profile Navigation Handler ───────────────────────────────────────────
  const handleOpenProfile = () => {
    if (!post) return;
    const rawUserId = post.userId;
    const caretakerId =
      typeof rawUserId === "object" && rawUserId !== null
        ? rawUserId._id
        : (rawUserId || (post as any).ownerId);

    if (caretakerId) {
      router.push(`/profile/${caretakerId}`);
    }
  };

  const images =
    post.images && post.images.length > 0
      ? post.images
      : ["https://placedog.net/600/400"];

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchPost(true)}
            tintColor="#F5A623"
            colors={["#F5A623"]}
          />
        }
      >
        {/* ── Hero Image & Back Button ── */}
        <View style={styles.heroWrapper}>
          <FlatList
            data={images}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(uri, index) => `${uri}-${index}`}
            onMomentumScrollEnd={(event) => setActiveImage(Math.round(event.nativeEvent.contentOffset.x / Dimensions.get("window").width))}
            renderItem={({ item }) => (
              <TouchableOpacity activeOpacity={0.95} onPress={() => setViewerVisible(true)}>
                <Image source={{ uri: item }} style={[styles.heroImage, { width: Dimensions.get("window").width }]} resizeMode="cover" />
              </TouchableOpacity>
            )}
          />
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
            activeOpacity={0.85}
          >
            <MaterialIcons name="arrow-back" size={22} color="#191C1D" />
          </TouchableOpacity>

          {images.length > 1 && (
            <PagingDots total={images.length} active={activeImage} />
          )}
          <View style={styles.imageCounter}><Text style={styles.imageCounterText}>{activeImage + 1} / {images.length}</Text></View>
        </View>

        {/* ── Identity Card ── */}
        <View style={styles.identityCardWrapper}>
          <View style={styles.identityCard}>
            <View style={styles.identityTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.petName}>{post.name}</Text>
                <Text style={styles.petBreed}>
                  {post.breed}
                  {post.customCategory ? ` (${post.customCategory})` : ""}
                </Text>
                <Text style={styles.postDate}>Posted {new Date(post.createdAt).toLocaleDateString()}</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: statusCfg.bg }]}>
                <MaterialIcons name={statusCfg.icon} size={14} color={statusCfg.color} />
                <Text style={[styles.statusText, { color: statusCfg.color }]}>{post.status}</Text>
              </View>
            </View>

            {/* Quick Info Chips */}
            <View style={styles.chipsRow}>
              {chips.map((c, i) => (
                <InfoChip key={i} icon={c.icon} label={c.label} />
              ))}
            </View>
          </View>
        </View>

        {/* ── About Section ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About {post.name}</Text>
          <View style={styles.sectionCard}>
            <Text style={styles.description}>{post.description}</Text>

            {/* Traits */}
            {traits.length > 0 && (
              <View style={styles.traitsBlock}>
                <Text style={styles.traitsHeading}>Characteristics</Text>
                <View style={styles.traitsWrap}>
                  {traits.map((t, i) => (
                    <View key={i} style={styles.traitChip}>
                      <MaterialIcons name="check" size={14} color="#D48806" />
                      <Text style={styles.traitText}>{t.label}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Health Status */}
            <View style={styles.healthStatusRow}>
              <Text style={styles.traitsHeading}>Health Status</Text>
              <View style={[styles.healthBadge, { backgroundColor: healthColors.backgroundColor }]}>
                <Text style={[styles.healthBadgeText, { color: healthColors.color }]}>{post.healthStatus}</Text>
              </View>
            </View>

            {/* Location (always visible in about section if caretaker card is hidden) */}
            {isOwner && (
              <View style={styles.locationInlineRow}>
                <MaterialIcons name="location-on" size={18} color="#F5A623" />
                <Text style={styles.locationInlineText}>{post.location}</Text>
              </View>
            )}

            {/* Action buttons if owner */}
            {isOwner && (
              <OwnerActionButtons
                onEdit={() =>
                  router.push(`/adoption-corner/EditAdoptionPost?postId=${post._id}`)
                }
                onDelete={() => setShowDeleteModal(true)}
                editLabel="Edit Post"
                deleteLabel="Delete Post"
              />
            )}
          </View>
        </View>

        {/* ── Poster / Caretaker Info (ONLY shown if caretaker is NOT the current user) ── */}
        {!isOwner && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Caretaker Info</Text>
            <View style={styles.posterCard}>
              <View style={styles.posterRow}>
                <TouchableOpacity
                  style={styles.posterUserTouchable}
                  onPress={handleOpenProfile}
                  activeOpacity={0.7}
                >
                  <View style={[styles.posterAvatar, styles.posterAvatarPlaceholder]}>
                    {post.userId?.avatar ? (
                      <Image
                        source={{ uri: post.userId.avatar }}
                        style={styles.posterAvatar}
                      />
                    ) : (
                      <MaterialIcons name="person" size={28} color="#717878" />
                    )}
                  </View>
                  <View style={styles.posterInfo}>
                    <Text style={styles.posterName}>
                      {post.posterName || post.userId?.name || "StrayCare User"}
                    </Text>
                    {post.userId?.organisation ? (
                      <Text style={styles.posterOrg}>{post.userId.organisation}</Text>
                    ) : (
                      <Text style={styles.viewProfileHint}>View Profile ›</Text>
                    )}
                  </View>
                </TouchableOpacity>

                {/* Call & Message Action Buttons */}
                <View style={styles.contactActions}>
                  <TouchableOpacity
                    style={styles.contactActionBtn}
                    onPress={handleMessage}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="chatbubble" size={18} color="#FFFFFF" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.contactActionBtn}
                    onPress={handleCall}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="call" size={18} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Location */}
              <View style={styles.locationRow}>
                <MaterialIcons name="location-on" size={16} color="#717878" />
                <Text style={styles.locationText}>{post.location}</Text>
              </View>
            </View>
          </View>
        )}

        {/* ── Notes if any ── */}
        {post.notes ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Additional Notes</Text>
            <View style={styles.sectionCard}>
              <Text style={styles.description}>{post.notes}</Text>
            </View>
          </View>
        ) : null}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <DeleteConfirmModal
          visible={showDeleteModal}
          postId={post._id}
          postName={post.name}
          onClose={() => setShowDeleteModal(false)}
          onDeleted={() => {
            setShowDeleteModal(false);
            router.replace("/adoption-corner");
          }}
        />
      )}
      <Modal visible={viewerVisible} animationType="fade" onRequestClose={() => setViewerVisible(false)} statusBarTranslucent>
        <SafeAreaView style={styles.viewer} edges={["top", "bottom"]}>
          <FlatList
            data={images}
            horizontal
            pagingEnabled
            initialScrollIndex={activeImage}
            getItemLayout={(_, index) => ({ length: Dimensions.get("window").width, offset: Dimensions.get("window").width * index, index })}
            showsHorizontalScrollIndicator={false}
            keyExtractor={(uri, index) => `viewer-${uri}-${index}`}
            onMomentumScrollEnd={(event) => setActiveImage(Math.round(event.nativeEvent.contentOffset.x / Dimensions.get("window").width))}
            renderItem={({ item }) => <View style={{ width: Dimensions.get("window").width, flex: 1, justifyContent: "center" }}><Image source={{ uri: item }} style={styles.viewerImage} resizeMode="contain" /></View>}
          />
          <TouchableOpacity style={styles.viewerClose} onPress={() => setViewerVisible(false)} accessibilityLabel="Close image viewer"><Ionicons name="close" size={28} color="#FFFFFF" /></TouchableOpacity>
          <Text style={styles.viewerCounter}>{activeImage + 1} / {images.length}</Text>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F8F9FA" },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 30 },

  centeredState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8F9FA",
    gap: 12,
    padding: 24,
  },
  loadingText: { fontSize: 14, color: "#717878" },
  errorText: { fontSize: 15, color: "#717878", textAlign: "center" },
  retryBtn: {
    marginTop: 8,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: "#F5A623",
  },
  retryText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  heroWrapper: {
    width: "100%",
    aspectRatio: 4 / 3,
    backgroundColor: "#F3F4F5",
    position: "relative",
  },
  heroImage: { width: "100%", height: "100%" },
  imageCounter: { position: "absolute", right: 14, top: 54, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 12, backgroundColor: "rgba(0,0,0,0.68)" },
  imageCounterText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
  viewer: { flex: 1, backgroundColor: "#000000" },
  viewerImage: { width: "100%", height: "100%" },
  viewerClose: { position: "absolute", top: 16, right: 16, width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(40,40,40,0.75)", alignItems: "center", justifyContent: "center" },
  viewerCounter: { position: "absolute", bottom: 24, alignSelf: "center", color: "#FFFFFF", fontSize: 14, fontWeight: "700", backgroundColor: "rgba(40,40,40,0.75)", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14 },
  backBtn: {
    position: "absolute",
    top: 52,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.72)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  dotsRow: {
    position: "absolute",
    bottom: 48,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  dot: { borderRadius: 4 },
  dotActive: { width: 24, height: 6, backgroundColor: "#F5A623" },
  dotInactive: {
    width: 6,
    height: 6,
    backgroundColor: "rgba(255,255,255,0.7)",
  },

  identityCardWrapper: { paddingHorizontal: 16, marginTop: -36, zIndex: 10 },
  identityCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    gap: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
  },
  identityTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  petName: { fontSize: 22, fontWeight: "700", color: "#191C1D" },
  petBreed: { fontSize: 14, color: "#717878", marginTop: 2 },
  postDate: { fontSize: 12, color: "#717878", marginTop: 4 },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FFF7E6",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: { fontSize: 12, fontWeight: "600", color: "#D48806" },

  chipsRow: { flexDirection: "row", gap: 10 },
  chip: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    backgroundColor: "#F8F9FA",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E0D6",
    gap: 6,
  },
  chipLabel: { fontSize: 12, fontWeight: "600", color: "#191C1D" },

  section: { paddingHorizontal: 16, marginTop: 18, gap: 8 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#191C1D",
    paddingLeft: 2,
  },
  sectionCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    gap: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  description: { fontSize: 14, color: "#717878", lineHeight: 22 },

  traitsBlock: { gap: 8 },
  traitsHeading: { fontSize: 13, fontWeight: "600", color: "#191C1D" },
  traitsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  traitChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#FFF7E6",
  },
  traitText: { fontSize: 12, fontWeight: "600", color: "#D48806" },

  healthStatusRow: {
    alignItems: "flex-start",
    gap: 8,
  },
  healthBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  healthBadgeText: { fontSize: 12, fontWeight: "700" },

  locationInlineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F5",
  },
  locationInlineText: {
    fontSize: 13,
    color: "#717878",
    fontWeight: "500",
    flex: 1,
  },

  posterCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  posterRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 12,
  },
  posterUserTouchable: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  posterAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#F3F4F5",
  },
  posterAvatarPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  posterInfo: { flex: 1 },
  posterName: { fontSize: 15, fontWeight: "700", color: "#191C1D" },
  posterOrg: { fontSize: 13, color: "#717878", marginTop: 2 },
  viewProfileHint: { fontSize: 12, color: "#F5A623", fontWeight: "600", marginTop: 2 },
  contactActions: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  contactActionBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F5A623",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#F5A623",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  locationText: {
    fontSize: 13,
    color: "#717878",
    fontWeight: "500",
    flex: 1,
  },
});
