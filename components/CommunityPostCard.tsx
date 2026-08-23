// components/CommunityPostCard.tsx

import React, { useState } from "react";
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import ReportModal from "./ReportPostModal";
import type { CommunityPost } from "../services/communityService";
import { colors } from "../constants/colors.constants";

// ─────────────────────────────────────────────
// COLORS  (matches CommunityPostMain palette)
// ─────────────────────────────────────────────

const C = {
  surface: "#F9F9FF",
  surfaceContainerLowest: "#FFFFFF",
  onSurface: "#121C2C",
  onSurfaceVariant: "#4D4637",
  outline: "#7F7665",
  outlineVariant: "#D1C5B2",
  primary: colors.primary,
  primaryContainer: "#FFF0DD",
  onPrimaryContainer: "#8A4A00",
};

// ─────────────────────────────────────────────
// PROPS
// ─────────────────────────────────────────────

interface CommunityPostCardProps {
  post: CommunityPost;
  onLike: (post: CommunityPost) => void | Promise<void>;
  onSave: (post: CommunityPost) => void | Promise<void>;
  onDelete: (post: CommunityPost) => void | Promise<void>;
  onReport: (
    postId: string,
    reason: string
  ) => void | Promise<void>;
}

// ─────────────────────────────────────────────
// DATE FORMATTER
// ─────────────────────────────────────────────

function formatDate(dateStr?: string): string {
  if (!dateStr) return "";

  const date = new Date(dateStr);

  return date
    .toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
    .toUpperCase();
}

// ─────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────

const CommunityPostCard: React.FC<
  CommunityPostCardProps
> = ({ post, onLike, onSave, onDelete, onReport }) => {
  const router = useRouter();

  // Report modal visibility
  const [reportVisible, setReportVisible] =
    useState(false);

  // Show / hide overflow menu
  const [menuVisible, setMenuVisible] =
    useState(false);

  // ── Navigate to full post ─────────────────
  const handlePress = () => {
    router.push({
      pathname:
        "/community-feed/CommunityPostView",
      params: { id: post._id },
    });
  };

  // ── Report submission ─────────────────────
  const handleReportSubmit = async (
    reason: string
  ) => {
    await onReport(post._id, reason);
  };

  return (
    <>
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.85}
        onPress={handlePress}
      >
        {/* ── Body ── */}
        <View style={styles.body}>
          {/* Author + overflow */}
          <View style={styles.topRow}>
            <View style={styles.authorRow}>
              {post.profileImage ? (
                <Image source={{ uri: post.profileImage }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Ionicons name="person" size={18} color={C.outline} />
                </View>
              )}
              <View style={styles.authorMeta}>
                <Text style={styles.authorText} numberOfLines={1}>
                  {post.username || post.authorName || "Community User"}
                </Text>
                <Text style={styles.dateText}>
                  {formatDate(post.date || post.submittedAt || post.createdAt)}
                </Text>
              </View>
            </View>

            {/* ⋮ Overflow */}
            <TouchableOpacity
              hitSlop={{
                top: 10,
                bottom: 10,
                left: 10,
                right: 10,
              }}
              onPress={(event) => {
                event.stopPropagation();
                setMenuVisible((prev) => !prev);
              }}
            >
              <Ionicons
                name="ellipsis-vertical"
                size={18}
                color={C.outline}
              />
            </TouchableOpacity>
          </View>

          {/* Overflow dropdown */}
          {menuVisible && (
            <View style={styles.overflowMenu}>
              {post.isOwner ? <>
                <TouchableOpacity style={styles.overflowMenuItem} onPress={() => {
                  setMenuVisible(false);
                  router.push({ pathname: "/community-feed/EditCommunityPost", params: { id: post._id } });
                }}>
                  <Ionicons name="create-outline" size={16} color={C.onSurface} />
                  <Text style={[styles.overflowMenuText, { color: C.onSurface }]}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.overflowMenuItem} onPress={() => {
                  setMenuVisible(false);
                  void onDelete(post);
                }}>
                  <Ionicons name="trash-outline" size={16} color="#E53935" />
                  <Text style={styles.overflowMenuText}>Delete</Text>
                </TouchableOpacity>
              </> : <TouchableOpacity
                style={
                  styles.overflowMenuItem
                }
                disabled={post.isReported}
                onPress={() => {
                  setMenuVisible(false);
                  setReportVisible(true);
                }}
              >
                <Ionicons
                  name="flag-outline"
                  size={16}
                  color={post.isReported ? C.outlineVariant : "#E53935"}
                />
                <Text
                  style={[
                    styles.overflowMenuText,
                    post.isReported && { color: C.outlineVariant },
                  ]}
                >
                  {post.isReported ? "Reported" : "Report"}
                </Text>
              </TouchableOpacity>}
            </View>
          )}

          {post.category ? (
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryBadgeText}>{post.category}</Text>
            </View>
          ) : null}

          {/* Title */}
          <Text
            style={styles.title}
            numberOfLines={2}
          >
            {post.title || "Untitled"}
          </Text>

          {/* Content preview */}
          <View style={styles.contentAccent}>
            <Text style={styles.content} numberOfLines={3}>{post.content || ""}</Text>
          </View>

          {post.imageUrl ? (
            <Image
              source={{ uri: post.imageUrl }}
              style={styles.image}
              resizeMode="cover"
            />
          ) : null}

          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.actionItem}
              hitSlop={8}
              onPress={(event) => {
                event.stopPropagation();
                void onLike(post);
              }}
            >
              <Ionicons name={post.isLiked ? "heart" : "heart-outline"} size={20} color={post.isLiked ? "#E53935" : C.outline} />
              <Text style={styles.actionCount}>{post.likeCount || 0}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionItem}
              hitSlop={8}
              onPress={(event) => {
                event.stopPropagation();
                router.push({
                  pathname: "/community-feed/CommunityPostComments",
                  params: { id: post._id },
                });
              }}
            >
              <Ionicons name="chatbubble-outline" size={19} color={C.outline} />
              <Text style={styles.actionCount}>{post.commentCount || 0}</Text>
            </TouchableOpacity>
            <View style={styles.actionSpacer} />
            <TouchableOpacity
              hitSlop={8}
              onPress={(event) => {
                event.stopPropagation();
                void onSave(post);
              }}
            >
              <Ionicons name={post.isSaved ? "bookmark" : "bookmark-outline"} size={21} color={post.isSaved ? C.primary : C.outline} />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>

      {/* ── Report Modal ── */}
      <ReportModal
        visible={reportVisible}
        onClose={() =>
          setReportVisible(false)
        }
        onSubmit={handleReportSubmit}
      />
    </>
  );
};

export default CommunityPostCard;

// ─────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor:
      C.surfaceContainerLowest,

    borderRadius: 16,

    borderWidth: 1,
    borderColor: "#D1C5B220",

    overflow: "hidden",

    // Android shadow
    elevation: 2,

    // iOS shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
  },

  image: {
    width: "100%",
    height: 180,
    borderRadius: 12,
    marginTop: 4,
  },

  body: {
    padding: 16,
    gap: 8,
  },

  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },

  avatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.primaryContainer,
  },

  authorMeta: {
    flex: 1,
    gap: 2,
  },

  categoryBadge: {
    backgroundColor: C.primaryContainer,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    alignSelf: "flex-start",
  },

  categoryBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: C.onPrimaryContainer,
    letterSpacing: 0.3,
  },

  // Overflow menu
  overflowMenu: {
    position: "absolute",
    top: 30,
    right: 0,
    zIndex: 10,

    backgroundColor: "#FFFFFF",
    borderRadius: 12,

    paddingVertical: 6,
    paddingHorizontal: 4,

    elevation: 6,

    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,

    minWidth: 130,
  },

  overflowMenuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,

    paddingVertical: 10,
    paddingHorizontal: 14,

    borderRadius: 8,
  },

  overflowMenuText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#E53935",
  },

  title: {
    fontSize: 16,
    fontWeight: "700",
    color: C.onSurface,
    lineHeight: 22,
  },

  content: {
    fontSize: 13,
    color: C.onSurfaceVariant,
    lineHeight: 19,
  },

  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
    marginTop: 6,
    paddingTop: 10,

    borderTopWidth: 1,
    borderTopColor: "#D1C5B215",
  },

  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },

  authorText: {
    fontSize: 14,
    fontWeight: "700",
    color: C.onSurface,
  },

  dateText: {
    fontSize: 11,
    fontWeight: "500",
    color: C.outlineVariant,
    letterSpacing: 0.3,
  },
  contentAccent: {
    borderLeftWidth: 3,
    borderLeftColor: C.primary,
    paddingLeft: 12,
  },

  actionItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },

  actionCount: {
    fontSize: 12,
    fontWeight: "600",
    color: C.onSurfaceVariant,
  },

  actionSpacer: {
    flex: 1,
  },
});
