import {
  Ionicons,
  MaterialCommunityIcons,
  MaterialIcons,
} from "@expo/vector-icons";

import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";

import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { useSafeAreaInsets } from "react-native-safe-area-context";

import CommunityPostCard from "../../components/CommunityPostCard";
import BackButton from "../../components/BackButton";
import {
  COMMUNITY_POST_CATEGORIES,
  type CommunityPostCategory,
} from "../../utils/communityPost.utils";

import {
  CommunityPost,
  getCommunityFeed,
  deleteCommunityPost,
  likeCommunityPost,
  saveCommunityPost,
  reportCommunityPost,
  unlikeCommunityPost,
  unsaveCommunityPost,
} from "../../services/communityService";

// ─────────────────────────────────────────────
// COLORS
// ─────────────────────────────────────────────

const C = {
  surface: "#FFFFFF",
  surfaceContainerLowest: "#FFFFFF",

  onSurface: "#121C2C",
  onSurfaceVariant: "#4D4637",

  outline: "#7F7665",
  outlineVariant: "#D1C5B2",

  primary: "#F28C28",
  primaryContainer: "#FFF0DD",
  onPrimaryContainer: "#8A4A00",
};

// ─────────────────────────────────────────────
// CATEGORIES
// ─────────────────────────────────────────────

// ─────────────────────────────────────────────
// COMMUNITY FEED SCREEN
// ─────────────────────────────────────────────

export default function CommunityPostMain() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [filterVisible, setFilterVisible] =
    useState(false);

  const [activeCategory, setActiveCategory] =
    useState("");

  const [searchText, setSearchText] =
    useState("");

  const [posts, setPosts] =
    useState<CommunityPost[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState(false);

  const pendingLikeIds = useRef(new Set<string>());
  const pendingSaveIds = useRef(new Set<string>());

  // ─────────────────────────────────────────────
  // FETCH POSTS
  // ─────────────────────────────────────────────

  const fetchPosts = async () => {
    try {
      setLoading(true);
      setError(false);

      const postsData =
        await getCommunityFeed();

      setPosts(
        Array.isArray(postsData)
          ? postsData
          : []
      );
    } catch (err) {
      console.error(
        "Community feed error:",
        err
      );

      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchPosts();
    }, [])
  );

  // ─────────────────────────────────────────────
  // LIKE / UNLIKE POST
  // ─────────────────────────────────────────────

  const handleLikePost = async (post: CommunityPost) => {
    if (pendingLikeIds.current.has(post._id)) return;

    const nextIsLiked = !post.isLiked;
    const previousLikeCount = post.likeCount || 0;
    const optimisticLikeCount = Math.max(0, previousLikeCount + (nextIsLiked ? 1 : -1));

    pendingLikeIds.current.add(post._id);
    setPosts((current) => current.map((item) =>
      item._id === post._id
        ? { ...item, isLiked: nextIsLiked, likeCount: optimisticLikeCount }
        : item
    ));

    try {
      const state = nextIsLiked
        ? await likeCommunityPost(post._id)
        : await unlikeCommunityPost(post._id);

      setPosts((current) => current.map((item) =>
        item._id === post._id
          ? { ...item, isLiked: state.isLiked, likeCount: state.likeCount }
          : item
      ));
    } catch (likeError) {
      setPosts((current) => current.map((item) =>
        item._id === post._id
          ? { ...item, isLiked: post.isLiked, likeCount: previousLikeCount }
          : item
      ));
      console.error("Community like error:", likeError);
      Alert.alert("Unable to update like", "Please try again.");
    } finally {
      pendingLikeIds.current.delete(post._id);
    }
  };

  // ─────────────────────────────────────────────
  // SAVE / UNSAVE POST
  // ─────────────────────────────────────────────

  const handleSavePost = async (post: CommunityPost) => {
    if (pendingSaveIds.current.has(post._id)) return;
    const nextIsSaved = !post.isSaved;
    pendingSaveIds.current.add(post._id);
    setPosts((current) => current.map((item) =>
      item._id === post._id ? { ...item, isSaved: nextIsSaved } : item
    ));

    try {
      const state = nextIsSaved
        ? await saveCommunityPost(post._id)
        : await unsaveCommunityPost(post._id);
      setPosts((current) => current.map((item) =>
        item._id === post._id ? { ...item, isSaved: state.isSaved } : item
      ));
    } catch (saveError) {
      setPosts((current) => current.map((item) =>
        item._id === post._id ? { ...item, isSaved: post.isSaved } : item
      ));
      console.error("Community save error:", saveError);
      Alert.alert("Unable to update saved post", "Please try again.");
    } finally {
      pendingSaveIds.current.delete(post._id);
    }
  };

  // ─────────────────────────────────────────────
  // DELETE POST
  // ─────────────────────────────────────────────

  const handleDeletePost = (post: CommunityPost) => {
    Alert.alert("Delete post?", "This action cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteCommunityPost(post._id);
            setPosts((current) => current.filter((item) => item._id !== post._id));
          } catch (deleteError) {
            console.error("Delete community post error:", deleteError);
            Alert.alert("Unable to delete post", "Please try again.");
          }
        },
      },
    ]);
  };

  // ─────────────────────────────────────────────
  // REPORT POST
  // ─────────────────────────────────────────────

  const handleReportPost = async (
    postId: string,
    reason: string
  ) => {
    try {
      // Calls your service function
      await reportCommunityPost(
        postId,
        reason
      );

      setPosts((currentPosts) =>
        currentPosts.map((post) =>
          post._id === postId ? { ...post, isReported: true } : post
        )
      );

      console.log(
        "Community post reported successfully"
      );
    } catch (error) {
      console.error(
        "Report post error:",
        error
      );

      // Throw the error back to the card
      // so the component can show an Alert
      throw error;
    }
  };

  // ─────────────────────────────────────────────
  // FILTER POSTS
  // ─────────────────────────────────────────────

  const filteredPosts = (
    Array.isArray(posts)
      ? posts
      : []
  ).filter((post) => {
    const search =
      searchText
        .trim()
        .toLowerCase();

    const matchesSearch =
      search === "" ||
      (post.title || "")
        .toLowerCase()
        .includes(search) ||
      (post.content || "")
        .toLowerCase()
        .includes(search) ||
      (post.username || post.authorName || "")
        .toLowerCase()
        .includes(search);

    const matchesCategory =
      activeCategory === "" ||
      post.category ===
      activeCategory;

    return (
      matchesSearch &&
      matchesCategory
    );
  });

  // ─────────────────────────────────────────────
  // UI
  // ─────────────────────────────────────────────

  return (
    <View style={styles.container}>
      {/* HEADER */}

      <View style={styles.header}>
        <BackButton onPress={() => router.back()} />

        <Text style={[styles.headerTitle, { flex: 1, textAlign: 'center' }]}>
          Community Feed
        </Text>

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() =>
            router.push(
              "/community-feed/CreateCommunityPost"
            )
          }
          style={{ width: 40, alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons
            name="add"
            size={27}
            color="#000000"
          />
        </TouchableOpacity>
      </View>

      {/* SEARCH */}

      <View
        style={styles.searchWrapper}
      >
        <View
          style={styles.searchBar}
        >
          <Ionicons
            name="search-outline"
            size={19}
            color={C.outline}
          />

          <TextInput
            style={
              styles.searchInput
            }
            placeholder="Search titles, content or authors..."
            placeholderTextColor={
              C.outline
            }
            value={searchText}
            onChangeText={
              setSearchText
            }
          />

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() =>
              setFilterVisible(
                (previous) =>
                  !previous
              )
            }
          >
            <MaterialIcons
              name="tune"
              size={21}
              color={
                filterVisible
                  ? C.primary
                  : C.onSurfaceVariant
              }
            />
          </TouchableOpacity>
        </View>

        {/* CATEGORY FILTER */}

        {filterVisible && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={
              false
            }
            style={
              styles.categoryScroll
            }
            contentContainerStyle={
              styles.categoryContent
            }
          >
            {/* ALL */}

            <TouchableOpacity
              style={[
                styles.categoryPill,

                activeCategory === ""
                  ? styles.categoryPillActive
                  : styles.categoryPillInactive,
              ]}
              onPress={() =>
                setActiveCategory("")
              }
            >
              <Text
                style={[
                  styles.categoryPillText,

                  {
                    color:
                      activeCategory === ""
                        ? C.onPrimaryContainer
                        : C.onSurfaceVariant,
                  },
                ]}
              >
                All
              </Text>
            </TouchableOpacity>

            {/* OTHER CATEGORIES */}

            {COMMUNITY_POST_CATEGORIES.map(
              (category: CommunityPostCategory) => {
                const isActive =
                  activeCategory ===
                  category;

                return (
                  <TouchableOpacity
                    key={category}
                    style={[
                      styles.categoryPill,

                      isActive
                        ? styles.categoryPillActive
                        : styles.categoryPillInactive,
                    ]}
                    onPress={() =>
                      setActiveCategory(
                        isActive
                          ? ""
                          : category
                      )
                    }
                  >
                    <Text
                      style={[
                        styles.categoryPillText,

                        {
                          color:
                            isActive
                              ? C.onPrimaryContainer
                              : C.onSurfaceVariant,
                        },
                      ]}
                    >
                      {category}
                    </Text>
                  </TouchableOpacity>
                );
              }
            )}
          </ScrollView>
        )}
      </View>

      {/* FEED */}

      <ScrollView
        style={styles.feed}
        contentContainerStyle={
          styles.feedContent
        }
        showsVerticalScrollIndicator={
          false
        }
      >
        {/* LOADING */}

        {loading && (
          <View
            style={
              styles.centeredState
            }
          >
            <ActivityIndicator
              size="large"
              color={C.primary}
            />

            <Text
              style={styles.stateText}
            >
              Loading posts...
            </Text>
          </View>
        )}

        {/* ERROR */}

        {!loading &&
          error && (
            <View
              style={
                styles.centeredState
              }
            >
              <MaterialCommunityIcons
                name="wifi-off"
                size={42}
                color={C.outline}
              />

              <Text
                style={
                  styles.stateText
                }
              >
                Failed to load posts.
              </Text>

              <TouchableOpacity
                style={
                  styles.retryBtn
                }
                onPress={fetchPosts}
              >
                <Text
                  style={
                    styles.retryBtnText
                  }
                >
                  Retry
                </Text>
              </TouchableOpacity>
            </View>
          )}

        {/* EMPTY */}

        {!loading &&
          !error &&
          filteredPosts.length ===
          0 && (
            <View
              style={
                styles.centeredState
              }
            >
              <MaterialCommunityIcons
                name="post-outline"
                size={42}
                color={C.outline}
              />

              <Text
                style={
                  styles.stateText
                }
              >
                No posts found.
              </Text>

              {(searchText ||
                activeCategory) && (
                  <TouchableOpacity
                    style={
                      styles.retryBtn
                    }
                    onPress={() => {
                      setSearchText("");
                      setActiveCategory(
                        ""
                      );
                    }}
                  >
                    <Text
                      style={
                        styles.retryBtnText
                      }
                    >
                      Clear filters
                    </Text>
                  </TouchableOpacity>
                )}
            </View>
          )}

        {/* POSTS */}

        {!loading &&
          !error &&
          filteredPosts.map(
            (post) => (
              <CommunityPostCard
                key={post._id}
                post={post}
                onLike={handleLikePost}
                onSave={handleSavePost}
                onDelete={handleDeletePost}
                onReport={
                  handleReportPost
                }
              />
            )
          )}

        <View
          style={{ height: 80 }}
        />
      </ScrollView>

      {/* FLOATING BUTTON */}

      <TouchableOpacity
        style={[
          styles.floatingButton,

          {
            bottom:
              100 +
              insets.bottom,
          },
        ]}
        activeOpacity={0.85}
        onPress={() =>
          router.push(
            "/forum" as any
          )
        }
      >
        <LinearGradient
          colors={[
            "#F28C28",
            "#F5B35F",
          ]}
          style={
            styles.gradientButton
          }
        >
          <Ionicons
            name="chatbubbles"
            size={28}
            color="#FFFFFF"
          />
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

// ─────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,

    backgroundColor:
      C.surface,

    paddingTop: 50,
  },

  header: {
    flexDirection: "row",

    justifyContent:
      "space-between",

    alignItems: "center",

    paddingHorizontal: 16,

    paddingVertical: 14,

    backgroundColor:
      C.surface,

    borderBottomWidth: 1,

    borderBottomColor:
      "#D1C5B220",
  },

  headerTitle: {
    fontSize: 18,

    fontWeight: "700",

    color:
      C.onSurface,
  },

  searchWrapper: {
    paddingHorizontal: 16,

    paddingVertical: 12,

    backgroundColor:
      C.surface,

    borderBottomWidth: 1,

    borderBottomColor:
      "#D1C5B215",

    gap: 10,
  },

  searchBar: {
    flexDirection: "row",

    alignItems: "center",

    gap: 8,

    backgroundColor:
      "#FFFFFF",

    borderWidth: 1,

    borderColor:
      "#D1C5B240",

    borderRadius: 999,

    paddingHorizontal: 14,

    paddingVertical: 10,
  },

  searchInput: {
    flex: 1,

    fontSize: 14,

    color:
      C.onSurface,

    padding: 0,
  },

  categoryScroll: {
    flexGrow: 0,
  },

  categoryContent: {
    gap: 8,

    paddingBottom: 2,
  },

  categoryPill: {
    paddingHorizontal: 16,

    paddingVertical: 8,

    borderRadius: 999,
  },

  categoryPillActive: {
    backgroundColor:
      C.primaryContainer,
  },

  categoryPillInactive: {
    backgroundColor:
      "#FFFFFF",

    borderWidth: 1,

    borderColor:
      "#D1C5B240",
  },

  categoryPillText: {
    fontSize: 12,

    fontWeight: "600",

    letterSpacing: 0.3,
  },

  feed: {
    flex: 1,
  },

  feedContent: {
    padding: 16,

    gap: 16,
  },

  centeredState: {
    alignItems: "center",

    justifyContent: "center",

    paddingVertical: 60,

    gap: 12,
  },

  stateText: {
    fontSize: 14,

    color:
      C.outline,

    fontWeight: "500",
  },

  retryBtn: {
    backgroundColor:
      C.primaryContainer,

    paddingHorizontal: 24,

    paddingVertical: 10,

    borderRadius: 999,
  },

  retryBtnText: {
    fontSize: 13,

    fontWeight: "700",

    color:
      C.onPrimaryContainer,
  },

  floatingButton: {
    position: "absolute",

    right: 24,

    width: 60,

    height: 60,

    borderRadius: 30,

    shadowColor: "#000",

    shadowOffset: {
      width: 0,
      height: 4,
    },

    shadowOpacity: 0.2,

    shadowRadius: 5,

    elevation: 6,
  },

  gradientButton: {
    width: "100%",

    height: "100%",

    borderRadius: 30,

    justifyContent: "center",

    alignItems: "center",
  },
});
