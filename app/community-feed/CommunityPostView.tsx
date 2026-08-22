// app/community-feed/CommunityPostView.tsx

import {
  Ionicons,
} from "@expo/vector-icons";

import {
  useLocalSearchParams,
  useRouter,
} from "expo-router";

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import BackButton from "../../components/BackButton";

import {
  getCommunityPost,
  CommunityPost,
  deleteCommunityPost,
  reportCommunityPost,
  likeCommunityPost,
  unlikeCommunityPost,
  saveCommunityPost,
  unsaveCommunityPost,
  getCommunityComments,
  createCommunityComment,
  deleteCommunityComment,
  updateCommunityComment,
  CommunityComment,
} from "../../services/communityService";
import ReportPostModal from "../../components/ReportPostModal";
import OwnerActionButtons from "../../components/OwnerActionButtons";
import { colors } from "../../constants/colors.constants";
import { useAuth } from "../../contexts/AuthContext";

// ─────────────────────────────────────────────
// DATES
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

function formatCommentDate(dateStr?: string): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ─────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────

export default function CommunityPostView() {
  const router = useRouter();
  const { user } = useAuth();

  const { id } = useLocalSearchParams<{ id: string }>();

  const [post, setPost] = useState<CommunityPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reportVisible, setReportVisible] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);

  // Likes & Saves State
  const [isLiking, setIsLiking] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Comments & Replies State
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{
    commentId: string;
    username: string;
  } | null>(null);
  const [editingComment, setEditingComment] = useState<CommunityComment | null>(null);
  const [commentActionTarget, setCommentActionTarget] = useState<CommunityComment | null>(null);
  const [deleteCommentTargetId, setDeleteCommentTargetId] = useState<string | null>(null);

  const inputRef = useRef<TextInput | null>(null);
  const scrollViewRef = useRef<ScrollView | null>(null);

  const handleDelete = () => {
    if (!post) return;
    Alert.alert("Delete post?", "This action cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteCommunityPost(post._id);
            router.replace("/community-feed/CommunityPostMain");
          } catch (deleteError: any) {
            Alert.alert(
              "Unable to delete post",
              deleteError?.response?.data?.message || "Please try again."
            );
          }
        },
      },
    ]);
  };

  // ─────────────────────────────────────────────
  // NAVIGATION TO PROFILE
  // ─────────────────────────────────────────────

  const handleAuthorPress = (authorId?: string | null) => {
    if (!authorId) return;
    if (user?._id && authorId === user._id) {
      router.push("/(tabs)/Profile");
    } else {
      router.push(`/profile/${authorId}`);
    }
  };

  // ─────────────────────────────────────────────
  // FETCH POST & COMMENTS
  // ─────────────────────────────────────────────

  const fetchPost = useCallback(async () => {
    if (!id) {
      setError(true);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(false);
      const postData = await getCommunityPost(id);
      setPost(postData);
    } catch (err) {
      console.error("Fetch community post error:", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchComments = useCallback(async () => {
    if (!id) return;
    try {
      setCommentsLoading(true);
      const result = await getCommunityComments(id);
      setComments(result.comments);
    } catch (err) {
      console.error("Fetch community comments error:", err);
    } finally {
      setCommentsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      void fetchPost();
      void fetchComments();
    }
  }, [id, fetchPost, fetchComments]);

  // ─────────────────────────────────────────────
  // LIKE & SAVE ACTIONS
  // ─────────────────────────────────────────────

  const handleLike = async () => {
    if (!post || isLiking) return;
    const currentlyLiked = post.isLiked;
    const currentCount = post.likeCount || 0;

    // Optimistic UI update
    setPost({
      ...post,
      isLiked: !currentlyLiked,
      likeCount: currentlyLiked ? Math.max(0, currentCount - 1) : currentCount + 1,
    });

    try {
      setIsLiking(true);
      if (currentlyLiked) {
        const res = await unlikeCommunityPost(post._id);
        setPost((prev) =>
          prev ? { ...prev, isLiked: res.isLiked, likeCount: res.likeCount } : null
        );
      } else {
        const res = await likeCommunityPost(post._id);
        setPost((prev) =>
          prev ? { ...prev, isLiked: res.isLiked, likeCount: res.likeCount } : null
        );
      }
    } catch (err) {
      // Revert on failure
      setPost((prev) =>
        prev ? { ...prev, isLiked: currentlyLiked, likeCount: currentCount } : null
      );
    } finally {
      setIsLiking(false);
    }
  };

  const handleSave = async () => {
    if (!post || isSaving) return;
    const currentlySaved = post.isSaved;

    // Optimistic UI update
    setPost({
      ...post,
      isSaved: !currentlySaved,
    });

    try {
      setIsSaving(true);
      if (currentlySaved) {
        const res = await unsaveCommunityPost(post._id);
        setPost((prev) => (prev ? { ...prev, isSaved: res.isSaved } : null));
      } else {
        const res = await saveCommunityPost(post._id);
        setPost((prev) => (prev ? { ...prev, isSaved: res.isSaved } : null));
      }
    } catch (err) {
      // Revert on failure
      setPost((prev) => (prev ? { ...prev, isSaved: currentlySaved } : null));
    } finally {
      setIsSaving(false);
    }
  };

  // ─────────────────────────────────────────────
  // COMMENT SUBMIT & REPLY
  // ─────────────────────────────────────────────

  const handleStartReply = (comment: CommunityComment) => {
    const targetParentId = comment.parentCommentId || comment._id;
    setReplyingTo({
      commentId: targetParentId,
      username: comment.username || "User",
    });
    inputRef.current?.focus();
  };

  const handleAddComment = async () => {
    const trimmed = commentText.trim();
    if (!id || !trimmed || submittingComment) return;

    try {
      setSubmittingComment(true);
      if (editingComment) {
        const updated = await updateCommunityComment(id, editingComment._id, trimmed);
        setComments((prev) =>
          prev.map((comment) => comment._id === updated._id ? updated : comment)
        );
        setCommentText("");
        setEditingComment(null);
        return;
      }
      const parentId = replyingTo ? replyingTo.commentId : null;
      const result = await createCommunityComment(id, trimmed, parentId);
      setComments((prev) => [...prev, result.comment]);
      setCommentText("");
      setReplyingTo(null);
      setPost((prev) =>
        prev ? { ...prev, commentCount: (prev.commentCount || 0) + 1 } : null
      );
    } catch (err: any) {
      Alert.alert(
        "Unable to post comment",
        err?.response?.data?.message || "Please try again."
      );
    } finally {
      setSubmittingComment(false);
    }
  };

  // ─────────────────────────────────────────────
  // COMMENT DELETE (LONG PRESS)
  // ─────────────────────────────────────────────

  const canDeleteComment = (comment: CommunityComment) => {
    if (comment.canDelete) return true;
    if (post?.isOwner) return true;
    if (user?._id && String(comment.userId) === String(user._id)) return true;
    return false;
  };

  const isCommentAuthor = (comment: CommunityComment) =>
    Boolean(user?._id && String(comment.userId) === String(user._id));

  const startEditingComment = (comment: CommunityComment) => {
    setReplyingTo(null);
    setEditingComment(comment);
    setCommentText(comment.content);
    inputRef.current?.focus();
  };

  const handleCommentLongPress = (comment: CommunityComment) => {
    if (!isCommentAuthor(comment) && !canDeleteComment(comment)) return;
    setCommentActionTarget(comment);
  };

  const confirmDeleteComment = (commentId: string) => {
    setCommentActionTarget(null);
    setDeleteCommentTargetId(commentId);
  };

  const executeDeleteComment = async (commentId: string) => {
    if (!post) return;
    try {
      // Optimistic delete
      setComments((prev) =>
        prev.filter((c) => c._id !== commentId && c.parentCommentId !== commentId)
      );
      const res = await deleteCommunityComment(post._id, commentId);
      setPost((prev) =>
        prev ? { ...prev, commentCount: res.commentCount } : null
      );
    } catch (deleteError: any) {
      Alert.alert(
        "Unable to delete comment",
        deleteError?.response?.data?.message || "Please try again."
      );
      void fetchComments();
    }
  };

  // ─────────────────────────────────────────────
  // IMAGE URL
  // ─────────────────────────────────────────────

  const getImageUrl = (imageUrl?: string | null) => {
    if (!imageUrl) return null;
    return imageUrl;
  };

  // Separate root comments and nested replies
  const rootComments = comments.filter((c) => !c.parentCommentId);
  const getReplies = (parentId: string) =>
    comments.filter((c) => c.parentCommentId === parentId);

  // ─────────────────────────────────────────────
  // UI
  // ─────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        {/* HEADER */}
        <View style={styles.header}>
          <BackButton onPress={() => router.back()} />

          <Text style={styles.headerTitle}>
            Community Feed
          </Text>

          <View style={{ width: 40 }} />
        </View>

        {/* LOADING */}
        {loading && (
          <View style={styles.centeredState}>
            <ActivityIndicator
              size="large"
              color="#775a00"
            />
            <Text style={styles.stateText}>
              Loading post...
            </Text>
          </View>
        )}

        {/* ERROR */}
        {!loading && error && (
          <View style={styles.centeredState}>
            <Ionicons
              name="cloud-offline-outline"
              size={40}
              color="#837565"
            />
            <Text style={styles.stateText}>
              Failed to load post.
            </Text>

            <TouchableOpacity
              style={styles.retryBtn}
              onPress={fetchPost}
            >
              <Text style={styles.retryBtnText}>
                Retry
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* POST CONTENT */}
        {!loading && !error && post && (
          <ScrollView
            ref={scrollViewRef}
            style={{ flex: 1 }}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.card}>
              {/* IMAGE + 3-DOTS CORNER BUTTON & DROPDOWN */}
              {getImageUrl(post.imageUrl) ? (
                <View style={styles.imageWrapper}>
                  <Image
                    source={{ uri: getImageUrl(post.imageUrl)! }}
                    style={styles.heroImage}
                    resizeMode="cover"
                  />
                  {/* 3-DOTS CORNER BUTTON & DROPDOWN (ONLY SHOWN FOR NON-OWNERS TO REPORT; OWNERS HAVE EDIT/DELETE BUTTONS AT BOTTOM) */}
                  {!post.isOwner && (
                    <>
                      <TouchableOpacity
                        style={styles.photoCornerDotsBtn}
                        onPress={() => setMenuVisible((prev) => !prev)}
                        activeOpacity={0.8}
                        hitSlop={8}
                      >
                        <Ionicons
                          name="ellipsis-horizontal"
                          size={18}
                          color="#ffffff"
                        />
                      </TouchableOpacity>

                      {/* IN-PLACE OVERFLOW DROPDOWN FOR PHOTO POSTS */}
                      {menuVisible && (
                        <View style={styles.photoOverflowDropdown}>
                          <TouchableOpacity
                            style={styles.overflowDropdownItem}
                            onPress={() => {
                              setMenuVisible(false);
                              setReportVisible(true);
                            }}
                          >
                            <Ionicons name="flag-outline" size={16} color="#E53935" />
                            <Text style={styles.overflowDropdownItemTextDestructive}>Report Post</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </>
                  )}
                </View>
              ) : null}

              <View style={styles.cardBody}>
                {/* DATE + CATEGORY + 3-DOTS FOR TEXT POSTS */}
                <View style={styles.metaRow}>
                  <Text style={styles.dateText}>
                    {formatDate(post.submittedAt || post.createdAt)}
                  </Text>

                  <View style={styles.metaRightGroup}>
                    {post.category && (
                      <View style={styles.tagBadge}>
                        <Text style={styles.tagText} numberOfLines={1}>
                          {post.category}
                        </Text>
                      </View>
                    )}

                    {!getImageUrl(post.imageUrl) && !post.isOwner && (
                      <View style={{ position: "relative" }}>
                        <TouchableOpacity
                          style={styles.textPostDotsBtn}
                          onPress={() => setMenuVisible((prev) => !prev)}
                          hitSlop={8}
                        >
                          <Ionicons
                            name="ellipsis-vertical"
                            size={18}
                            color="#685F51"
                          />
                        </TouchableOpacity>

                        {/* IN-PLACE OVERFLOW DROPDOWN FOR TEXT POSTS */}
                        {menuVisible && (
                          <View style={styles.textOverflowDropdown}>
                            <TouchableOpacity
                              style={styles.overflowDropdownItem}
                              onPress={() => {
                                setMenuVisible(false);
                                setReportVisible(true);
                              }}
                            >
                              <Ionicons name="flag-outline" size={16} color="#E53935" />
                              <Text style={styles.overflowDropdownItemTextDestructive}>Report Post</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                </View>

                {/* TITLE */}
                <Text style={styles.headline}>
                  {post.title}
                </Text>

                {/* AUTHOR (CLICKABLE) */}
                <TouchableOpacity
                  style={styles.authorRow}
                  onPress={() =>
                    handleAuthorPress(post.authorUserId || post.authorId)
                  }
                  activeOpacity={0.7}
                >
                  <View style={styles.authorInfo}>
                    {post.profileImage ? (
                      <Image
                        source={{ uri: post.profileImage }}
                        style={styles.authorAvatar}
                      />
                    ) : (
                      <View style={styles.authorAvatarFallback}>
                        <Ionicons name="person" size={16} color="#7F7665" />
                      </View>
                    )}
                    <Text style={styles.authorText}>
                      Posted by{" "}
                      <Text style={styles.authorName}>
                        {post.username || post.authorName || "Community User"}
                      </Text>
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#A89E8F" />
                </TouchableOpacity>

                {/* CONTENT */}
                <View style={styles.contentAccent}>
                  <Text style={styles.description}>{post.content}</Text>
                </View>

                {/* ── ENGAGEMENT BAR (LIKES, COMMENTS, SAVE) ── */}
                <View style={styles.cardActionRow}>
                  {/* Like button */}
                  <TouchableOpacity
                    style={styles.cardActionBtn}
                    onPress={handleLike}
                    activeOpacity={0.7}
                    hitSlop={8}
                  >
                    <Ionicons
                      name={post.isLiked ? "heart" : "heart-outline"}
                      size={22}
                      color={post.isLiked ? "#E53935" : "#685F51"}
                    />
                    <Text
                      style={[
                        styles.cardActionText,
                        post.isLiked && styles.cardActionTextActive,
                      ]}
                    >
                      {post.likeCount || 0} {post.likeCount === 1 ? "Like" : "Likes"}
                    </Text>
                  </TouchableOpacity>

                  {/* Comment counter indicator */}
                  <TouchableOpacity
                    style={styles.cardActionBtn}
                    onPress={() => inputRef.current?.focus()}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name="chatbubble-outline"
                      size={20}
                      color="#685F51"
                    />
                    <Text style={styles.cardActionText}>
                      {comments.length || post.commentCount || 0}{" "}
                      {(comments.length || post.commentCount) === 1 ? "Comment" : "Comments"}
                    </Text>
                  </TouchableOpacity>

                  <View style={{ flex: 1 }} />

                  {/* Save bookmark */}
                  <TouchableOpacity
                    style={styles.saveBtn}
                    onPress={handleSave}
                    activeOpacity={0.7}
                    hitSlop={8}
                  >
                    <Ionicons
                      name={post.isSaved ? "bookmark" : "bookmark-outline"}
                      size={22}
                      color={post.isSaved ? colors.primary : "#685F51"}
                    />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* ── COMMENTS SECTION ── */}
            <View style={styles.commentsSection}>
              <View style={styles.commentsHeaderRow}>
                <View style={styles.commentsTitleGroup}>
                  <Ionicons name="chatbubbles" size={20} color="#161c27" />
                  <Text style={styles.commentsSectionTitle}>Comments</Text>
                </View>
                <View style={styles.commentsCountBadge}>
                  <Text style={styles.commentsCountBadgeText}>{comments.length}</Text>
                </View>
              </View>

              {/* Comments List / State */}
              {commentsLoading ? (
                <View style={styles.commentsLoading}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.commentsLoadingText}>Loading comments...</Text>
                </View>
              ) : comments.length === 0 ? (
                <View style={styles.noCommentsContainer}>
                  <Ionicons name="chatbubbles-outline" size={36} color="#D2C7B6" />
                  <Text style={styles.noCommentsTitle}>No comments yet</Text>
                  <Text style={styles.noCommentsSub}>Be the first to share your thoughts!</Text>
                </View>
              ) : (
                <View style={styles.commentsList}>
                  {rootComments.map((comment) => {
                    const replies = getReplies(comment._id);
                    return (
                      <View key={comment._id} style={styles.commentBlock}>
                        {/* Parent Comment */}
                        <TouchableOpacity
                          activeOpacity={0.9}
                          onLongPress={() => handleCommentLongPress(comment)}
                          delayLongPress={350}
                          style={styles.commentCard}
                        >
                          <TouchableOpacity
                            onPress={() => handleAuthorPress(comment.userId)}
                            activeOpacity={0.7}
                          >
                            {comment.profileImage ? (
                              <Image
                                source={{ uri: comment.profileImage }}
                                style={styles.commentAvatar}
                              />
                            ) : (
                              <View style={styles.commentAvatarFallback}>
                                <Ionicons name="person" size={16} color="#7F7665" />
                              </View>
                            )}
                          </TouchableOpacity>

                          <View style={styles.commentContentWrapper}>
                            <View style={styles.commentMetaRow}>
                              <TouchableOpacity
                                onPress={() => handleAuthorPress(comment.userId)}
                                activeOpacity={0.7}
                                style={{ flex: 1 }}
                              >
                                <Text style={styles.commentUsername} numberOfLines={1}>
                                  {comment.username || "Community Member"}
                                </Text>
                              </TouchableOpacity>
                              <Text style={styles.commentDate}>
                                {formatCommentDate(comment.createdAt)}
                              </Text>
                            </View>
                            <Text
                              style={styles.commentText}
                              onLongPress={() => handleCommentLongPress(comment)}
                              suppressHighlighting
                            >
                              {comment.content}
                            </Text>
                            
                            <View style={styles.commentFooterRow}>
                              <TouchableOpacity
                                style={styles.replyActionBtn}
                                onPress={() => handleStartReply(comment)}
                                hitSlop={6}
                              >
                                <Ionicons name="return-down-forward" size={14} color="#8A7E6C" />
                                <Text style={styles.replyActionText}>Reply</Text>
                              </TouchableOpacity>

                            </View>
                          </View>
                        </TouchableOpacity>

                        {/* Nested Replies */}
                        {replies.length > 0 && (
                          <View style={styles.repliesWrapper}>
                            {replies.map((reply) => {
                              return (
                                <TouchableOpacity
                                  key={reply._id}
                                  activeOpacity={0.9}
                                  onLongPress={() => handleCommentLongPress(reply)}
                                  delayLongPress={350}
                                  style={styles.replyCard}
                                >
                                  <TouchableOpacity
                                    onPress={() => handleAuthorPress(reply.userId)}
                                    activeOpacity={0.7}
                                  >
                                    {reply.profileImage ? (
                                      <Image
                                        source={{ uri: reply.profileImage }}
                                        style={styles.replyAvatar}
                                      />
                                    ) : (
                                      <View style={styles.replyAvatarFallback}>
                                        <Ionicons name="person" size={13} color="#7F7665" />
                                      </View>
                                    )}
                                  </TouchableOpacity>

                                  <View style={styles.replyContentWrapper}>
                                    <View style={styles.commentMetaRow}>
                                      <TouchableOpacity
                                        onPress={() => handleAuthorPress(reply.userId)}
                                        activeOpacity={0.7}
                                        style={{ flex: 1 }}
                                      >
                                        <Text style={styles.replyUsername} numberOfLines={1}>
                                          {reply.username || "Community Member"}
                                        </Text>
                                      </TouchableOpacity>
                                      <Text style={styles.commentDate}>
                                        {formatCommentDate(reply.createdAt)}
                                      </Text>
                                    </View>
                                    <Text
                                      style={styles.replyText}
                                      onLongPress={() => handleCommentLongPress(reply)}
                                      suppressHighlighting
                                    >
                                      {reply.content}
                                    </Text>

                                    <View style={styles.commentFooterRow}>
                                      <TouchableOpacity
                                        style={styles.replyActionBtn}
                                        onPress={() => handleStartReply(reply)}
                                        hitSlop={6}
                                      >
                                        <Ionicons name="return-down-forward" size={13} color="#8A7E6C" />
                                        <Text style={styles.replyActionText}>Reply</Text>
                                      </TouchableOpacity>

                                    </View>
                                  </View>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}
            </View>

            {/* OWNER ACTION BUTTONS IF OWNER */}
            {post.isOwner && (
              <View style={styles.actionsContainer}>
                <OwnerActionButtons
                  onEdit={() =>
                    router.push({
                      pathname: "/community-feed/EditCommunityPost",
                      params: { id: post._id },
                    })
                  }
                  onDelete={handleDelete}
                  editLabel="Edit Post"
                  deleteLabel="Delete Post"
                  containerStyle={{ marginTop: 0, borderTopWidth: 0, paddingTop: 0 }}
                />
              </View>
            )}
          </ScrollView>
        )}

        {/* ── DOCKED BOTTOM COMPOSER ── */}
        {!loading && !error && post && (
          <View style={styles.bottomComposerContainer}>
            {(replyingTo || editingComment) && (
              <View style={styles.replyingBar}>
                <View style={styles.replyingLeftGroup}>
                  <Ionicons name={editingComment ? "create-outline" : "return-down-forward"} size={14} color="#8B5E00" />
                  <Text style={styles.replyingText}>
                    {editingComment ? "Editing your comment" : <>Replying to <Text style={styles.replyingUsername}>@{replyingTo?.username}</Text></>}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setReplyingTo(null);
                    setEditingComment(null);
                    setCommentText("");
                  }}
                  hitSlop={8}
                >
                  <Ionicons name="close-circle" size={18} color="#8A7E6C" />
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.composerWrapper}>
              <TextInput
                ref={inputRef}
                style={styles.commentInput}
                placeholder={
                  editingComment
                    ? "Edit your comment…"
                    : replyingTo
                    ? `Reply to @${replyingTo.username}…`
                    : "Write a comment…"
                }
                placeholderTextColor="#9E9385"
                value={commentText}
                onChangeText={setCommentText}
                multiline
                maxLength={500}
                editable={!submittingComment}
              />
              <TouchableOpacity
                style={[
                  styles.sendBtn,
                  (!commentText.trim() || submittingComment) && styles.sendBtnDisabled,
                ]}
                onPress={handleAddComment}
                disabled={!commentText.trim() || submittingComment}
              >
                {submittingComment ? (
                  <ActivityIndicator size="small" color="#161c27" />
                ) : (
                  <Ionicons name="send" size={16} color="#161c27" />
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* REPORT POST MODAL */}
        <ReportPostModal
          visible={reportVisible}
          onClose={() => setReportVisible(false)}
          onSubmit={async (reason) => {
            if (post) await reportCommunityPost(post._id, reason);
          }}
        />

        <Modal
          transparent
          animationType="fade"
          visible={Boolean(commentActionTarget)}
          onRequestClose={() => setCommentActionTarget(null)}
        >
          <TouchableOpacity
            style={styles.commentModalBackdrop}
            activeOpacity={1}
            onPress={() => setCommentActionTarget(null)}
          >
            <TouchableOpacity activeOpacity={1} style={styles.commentModalCard}>
              <Text style={styles.commentModalTitle}>Comment actions</Text>
              <Text style={styles.commentModalMessage}>Choose an action for this comment.</Text>

              {commentActionTarget && isCommentAuthor(commentActionTarget) && (
                <TouchableOpacity
                  style={styles.commentModalEditButton}
                  onPress={() => {
                    const target = commentActionTarget;
                    setCommentActionTarget(null);
                    startEditingComment(target);
                  }}
                >
                  <Ionicons name="create-outline" size={19} color="#7A4A00" />
                  <Text style={styles.commentModalEditText}>Edit comment</Text>
                </TouchableOpacity>
              )}

              {commentActionTarget && canDeleteComment(commentActionTarget) && (
                <TouchableOpacity
                  style={styles.commentModalDeleteButton}
                  onPress={() => confirmDeleteComment(commentActionTarget._id)}
                >
                  <Ionicons name="trash-outline" size={19} color="#FFFFFF" />
                  <Text style={styles.commentModalDeleteText}>Delete comment</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.commentModalCancelButton}
                onPress={() => setCommentActionTarget(null)}
              >
                <Text style={styles.commentModalCancelText}>Cancel</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>

        <Modal
          transparent
          animationType="fade"
          visible={Boolean(deleteCommentTargetId)}
          onRequestClose={() => setDeleteCommentTargetId(null)}
        >
          <View style={styles.commentModalBackdrop}>
            <View style={styles.commentModalCard}>
              <Text style={styles.commentModalTitle}>Delete comment?</Text>
              <Text style={styles.commentModalMessage}>
                This will also remove any replies to this comment.
              </Text>
              <TouchableOpacity
                style={styles.commentModalDeleteButton}
                onPress={() => {
                  const commentId = deleteCommentTargetId;
                  setDeleteCommentTargetId(null);
                  if (commentId) void executeDeleteComment(commentId);
                }}
              >
                <Ionicons name="trash-outline" size={19} color="#FFFFFF" />
                <Text style={styles.commentModalDeleteText}>Delete comment</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.commentModalCancelButton}
                onPress={() => setDeleteCommentTargetId(null)}
              >
                <Text style={styles.commentModalCancelText}>Keep comment</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 12,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F1F1",
  },

  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },

  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#161c27",
  },

  centeredState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },

  stateText: {
    fontSize: 14,
    color: "#837565",
    fontWeight: "500",
  },

  retryBtn: {
    backgroundColor: "#fcd371",
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 999,
  },

  retryBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#775a00",
  },

  scrollContent: {
    padding: 16,
    paddingBottom: 32,
    gap: 16,
  },

  card: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    overflow: "visible",
    borderWidth: 1,
    borderColor: "#EFEFEF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    zIndex: 10,
  },

  imageWrapper: {
    position: "relative",
    width: "100%",
    height: 220,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    overflow: "hidden",
    zIndex: 20,
  },

  heroImage: {
    width: "100%",
    height: "100%",
  },

  photoCornerDotsBtn: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 30,
  },

  /* ── In-place Dropdown Menus ── */
  photoOverflowDropdown: {
    position: "absolute",
    top: 50,
    right: 12,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    paddingVertical: 4,
    minWidth: 140,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 10,
    borderWidth: 1,
    borderColor: "#EAEAEA",
    zIndex: 40,
  },

  textOverflowDropdown: {
    position: "absolute",
    top: 34,
    right: 0,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    paddingVertical: 4,
    minWidth: 140,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 10,
    borderWidth: 1,
    borderColor: "#EAEAEA",
    zIndex: 40,
  },

  overflowDropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },

  overflowDropdownItemText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#161c27",
  },

  overflowDropdownItemTextDestructive: {
    fontSize: 13,
    fontWeight: "600",
    color: "#E53935",
  },

  overflowDropdownDivider: {
    height: 1,
    backgroundColor: "#F3F3F3",
    marginHorizontal: 8,
  },

  cardBody: {
    padding: 18,
    gap: 12,
  },

  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  metaRightGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  dateText: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.8,
    color: "#837565",
  },

  tagBadge: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    maxWidth: 160,
  },

  tagText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.text,
  },

  textPostDotsBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#F3EFEA",
    alignItems: "center",
    justifyContent: "center",
  },

  headline: {
    fontSize: 21,
    fontWeight: "800",
    color: "#161c27",
    lineHeight: 27,
  },

  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#F3F3F3",
  },

  authorInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },

  authorAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },

  authorAvatarFallback: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#FFF0DD",
    alignItems: "center",
    justifyContent: "center",
  },

  authorText: {
    fontSize: 14,
    color: "#504537",
    flex: 1,
  },

  authorName: {
    fontWeight: "700",
    color: "#161c27",
  },

  contentAccent: {
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    paddingLeft: 14,
    marginVertical: 4,
  },

  description: {
    fontSize: 15,
    color: "#4A4032",
    lineHeight: 24,
  },

  /* ── Engagement Action Row inside Card ── */
  cardActionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 14,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: "#F3F3F3",
    gap: 16,
  },

  cardActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  cardActionText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#685F51",
  },

  cardActionTextActive: {
    color: "#E53935",
    fontWeight: "700",
  },

  saveBtn: {
    padding: 4,
  },

  /* ── Comments Section ── */
  commentsSection: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: "#EFEFEF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    gap: 14,
  },

  commentsHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  commentsTitleGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  commentsSectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#161c27",
  },

  commentsCountBadge: {
    backgroundColor: "#FFF2DE",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },

  commentsCountBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#8B5E00",
  },

  commentsLoading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 18,
  },

  commentsLoadingText: {
    fontSize: 13,
    color: "#837565",
  },

  noCommentsContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
    gap: 6,
  },

  noCommentsTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#5C5243",
  },

  noCommentsSub: {
    fontSize: 13,
    color: "#8F8474",
  },

  commentsList: {
    gap: 14,
    marginTop: 4,
  },

  commentBlock: {
    gap: 10,
  },

  commentCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },

  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },

  commentAvatarFallback: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FFF0DD",
    alignItems: "center",
    justifyContent: "center",
  },

  commentContentWrapper: {
    flex: 1,
    backgroundColor: "#FAF9F6",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#EFEBE4",
  },

  commentMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 4,
  },

  commentUsername: {
    fontSize: 13,
    fontWeight: "700",
    color: "#161c27",
    flex: 1,
  },

  commentDate: {
    fontSize: 11,
    color: "#8C8171",
  },

  commentText: {
    fontSize: 14,
    color: "#4A4032",
    lineHeight: 20,
  },

  commentFooterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#EAE5DC60",
  },

  replyActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },

  replyActionText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#8A7E6C",
  },

  deleteActionBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },

  /* ── Replies styling ── */
  repliesWrapper: {
    marginLeft: 24,
    paddingLeft: 12,
    borderLeftWidth: 2,
    borderLeftColor: "#E8E2D8",
    gap: 10,
  },

  replyCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },

  replyAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },

  replyAvatarFallback: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#FFF0DD",
    alignItems: "center",
    justifyContent: "center",
  },

  replyContentWrapper: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: "#EAE5DC",
  },

  replyUsername: {
    fontSize: 12,
    fontWeight: "700",
    color: "#161c27",
    flex: 1,
  },

  replyText: {
    fontSize: 13,
    color: "#4A4032",
    lineHeight: 18,
  },

  /* ── Actions ── */
  actionsContainer: {
    marginTop: 4,
  },

  /* ── Bottom Docked Composer ── */
  bottomComposerContainer: {
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#EFEFEF",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 8,
  },

  replyingBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFF5E5",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#FFE2B3",
  },

  replyingLeftGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },

  replyingText: {
    fontSize: 12,
    color: "#8B5E00",
  },

  replyingUsername: {
    fontWeight: "700",
  },

  composerWrapper: {
    flexDirection: "row",
    alignItems: "flex-end",
    backgroundColor: "#F7F6F2",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#EAE5DC",
    gap: 8,
  },

  commentInput: {
    flex: 1,
    minHeight: 38,
    maxHeight: 100,
    paddingVertical: 6,
    fontSize: 14,
    color: "#161c27",
  },

  sendBtn: {
    backgroundColor: colors.primary,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },

  sendBtnDisabled: {
    opacity: 0.4,
  },

  commentModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.48)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },

  commentModalCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 20,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 12,
  },

  commentModalTitle: {
    color: "#161C27",
    fontSize: 19,
    fontWeight: "700",
    textAlign: "center",
  },

  commentModalMessage: {
    color: "#6F685E",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 6,
    marginBottom: 18,
  },

  commentModalEditButton: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: "#FFE0A3",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 10,
  },

  commentModalEditText: {
    color: "#7A4A00",
    fontSize: 15,
    fontWeight: "700",
  },

  commentModalDeleteButton: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: "#C62828",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 10,
  },

  commentModalDeleteText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },

  commentModalCancelButton: {
    minHeight: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  commentModalCancelText: {
    color: "#514B43",
    fontSize: 15,
    fontWeight: "600",
  },
});
