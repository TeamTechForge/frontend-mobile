import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Share,
  Clipboard,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { Ionicons, Feather } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import BackButton from "../../components/BackButton";

import { API_URL } from "../../constants/config.constants";
import { useAuth } from "../../contexts/AuthContext";
import { useChatApi } from "../../hooks/useChatApi";
import { useCall } from "../../contexts/CallContext";
import PrimaryButton from "../../components/PrimaryButton";
import EmptyStateCard from "../../components/profile/EmptyStateCard";
import PostPreviewCard from "../../components/profile/PostPreviewCard";
import ReportPreviewCard from "../../components/profile/ReportPreviewCard";
import DropdownMenu from "../../components/profile/DropdownMenu";
import ReportUserModal from "../../components/profile/ReportUserModal";
import ProfileStatsRow from "../../components/profile/ProfileStatsRow";
import ImageViewer from "../../components/ui/ImageViewer";

const BRAND_COLOR = "#F5A623";

interface Post {
  _id: string;
  title: string;
  tag: string;
  author: string;
  imageUrl?: string;
  likes: number;
  likeCount?: number;
  commentCount: number;
  comments?: number;
  createdAt: string;
}

interface Report {
  _id: string;
  caseId: string;
  animalType: string;
  breed?: string;
  status: string;
  notes?: string;
  description?: string;
  anonymous?: boolean;
  location?: { address?: string };
  photos?: string[];
  createdAt: string;
  summary?: string;
}

interface Rescue {
  _id: string;
  status: string;
  animalDetails?: { type?: string; breed?: string; notes?: string };
  location?: { address?: string };
  createdAt: string;
  summary?: string;
}

export default function PublicProfileScreen() {
  const router = useRouter();
  const { userId } = useLocalSearchParams();
  const { user, refreshUser } = useAuth();
  const { createConversation } = useChatApi();
  const { startCall } = useCall();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Profile Data
  const [userData, setUserData] = useState<any>(null);
  const [profileData, setProfileData] = useState<any>(null);
  const [statsData, setStatsData] = useState<any>({});
  const [permissions, setPermissions] = useState<any>(null);

  // Tab Data
  const [posts, setPosts] = useState<Post[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [rescues, setRescues] = useState<Rescue[]>([]);

  // UI States
  const [activeTab, setActiveTab] = useState<string>("posts");
  const [menuVisible, setMenuVisible] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [isViewerVisible, setIsViewerVisible] = useState(false);

  const isOwner = !!user?._id && (String(user._id) === String(userId) || String((user as any).id) === String(userId));

  const fetchProfileAndStats = async () => {
    try {
      if (!userId || typeof userId !== "string" || !/^[0-9a-fA-F]{24}$/.test(userId)) {
        console.warn(`Invalid userId passed to profile route: ${userId}`);
        setLoading(false);
        return;
      }

      const token = await SecureStore.getItemAsync("authToken");

      // 1. Fetch public profile and stats
      const response = await fetch(`${API_URL}/users/${userId}/public-profile`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn("Profile fetch failed:", response.status, errorText);
        throw new Error(`Failed to fetch profile: ${response.status} ${errorText}`);
      }

      const data = (await response.json()) as any;
      setUserData(data.user);
      setProfileData(data.profile);
      setStatsData(data.stats);
      setPermissions(data.permissions);

      // Set initial tab based on role
      if (data.user.role === "general_user") {
        setActiveTab("reports");
      } else {
        setActiveTab("posts");
      }

      // 2. Fetch posts
      const postsRes = await fetch(`${API_URL}/users/${userId}/posts`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (postsRes.ok) {
        const postsData = (await postsRes.json()) as any;
        setPosts(postsData);
      }

      // 3. Fetch reports
      const reportsRes = await fetch(`${API_URL}/users/${userId}/reports`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (reportsRes.ok) {
        const reportsData = (await reportsRes.json()) as any;
        setReports(reportsData);
      }

      // 4. Fetch rescues (if volunteer/vet/ngo)
      if (data.user.role !== "general_user") {
        const rescuesRes = await fetch(`${API_URL}/rescues/my-rescues?userId=${userId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (rescuesRes.ok) {
          const rescuesData = (await rescuesRes.json()) as any;
          setRescues(rescuesData);
        }
      }

    } catch (error: any) {
      console.warn("Error fetching public profile:", error);
      Alert.alert("Error", "Could not load user profile.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (userId) {
      fetchProfileAndStats();
    }
  }, [userId]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchProfileAndStats();
  };

  const handleMessage = async () => {
    if (!user) {
      Alert.alert("Authentication required", "Please log in to message this user.");
      return;
    }

    if (user._id === userId) {
      Alert.alert("Error", "You cannot message yourself.");
      return;
    }

    setLoading(true);
    try {
      const conversation = (await createConversation(userId as string, "direct")) as any;
      const otherParticipant = conversation.participants?.find(
        (p: any) => p._id !== user._id
      );

      router.push({
        pathname: "/chat/[conversationId]",
        params: {
          conversationId: conversation._id,
          recipientName: otherParticipant?.name || userData?.name || "Chat",
          recipientId: userId as string,
          recipientImage: otherParticipant?.profileImage || profileData?.profileImage || userData?.avatar || "",
        },
      });
    } catch (error: any) {
      console.error("Failed to start/open conversation:", error);
      Alert.alert(
        "Could Not Start Chat",
        error.message || "Something went wrong while starting the conversation."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCall = () => {
    if (!user) {
      Alert.alert("Authentication required", "Please log in to call this user.");
      return;
    }

    if (user._id === userId) {
      Alert.alert("Error", "You cannot call yourself.");
      return;
    }

    startCall(userId as string, userData?.name || "User", profileData?.profileImage || userData?.avatar || "");
  };

  const handleShare = async () => {
    try {
      const shareUrl = `https://straycare.org/profile/${userId}`;
      await Share.share({
        message: `Check out ${userData?.name}'s profile on StrayCare: ${shareUrl}`,
        url: shareUrl,
      });
    } catch (error: any) {
      Alert.alert("Error", error.message);
    }
  };

  const handleCopyLink = () => {
    const shareUrl = `https://straycare.org/profile/${userId}`;
    Clipboard.setString(shareUrl);
    Alert.alert("Link Copied", "Profile link copied to clipboard.");
  };

  const handleBlockUser = async () => {
    try {
      const token = await SecureStore.getItemAsync("authToken");
      if (!token) {
        Alert.alert("Authentication required", "Please log in to block this user.");
        return;
      }

      const response = await fetch(`${API_URL}/users/${userId}/block`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        }
      });

      const resData: any = await response.json();

      if (response.ok) {
        Alert.alert("Success", resData.message);
        setMenuVisible(false);
        refreshUser();
      } else {
        Alert.alert("Error", resData.message || "Failed to block user.");
      }
    } catch (error: any) {
      console.error("Block user error:", error);
      Alert.alert("Error", "Something went wrong. Please check your connection.");
    }
  };

  const handleReportSubmit = async (reason: string, description: string): Promise<boolean> => {
    try {
      const token = await SecureStore.getItemAsync("authToken");
      if (!token) {
        Alert.alert("Authentication required", "Please log in to submit a report.");
        return false;
      }

      const response = await fetch(`${API_URL}/reports/user`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          reportedUserId: userId,
          reason,
          description,
        }),
      });

      const resData = (await response.json()) as any;
      if (response.ok) {
        Alert.alert("Success", "User has been reported. Our admin team will review this shortly.");
        return true;
      } else {
        Alert.alert("Error", resData.message || "Failed to submit report.");
        return false;
      }
    } catch (error) {
      console.error("Report submit error:", error);
      Alert.alert("Error", "Something went wrong. Please check your connection.");
      return false;
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={BRAND_COLOR} />
      </View>
    );
  }

  if (!userData) {
    return (
      <View style={styles.loadingContainer}>
        <Text>User not found</Text>
      </View>
    );
  }

  // Determine user role label
  const getRoleLabel = (role: string) => {
    switch (role) {
      case "general_user":
        return "General User";
      case "volunteer":
        return "Volunteer";
      case "vet":
        return "Veterinarian";
      case "ngo":
        return "NGO / Shelter";
      default:
        return "Member";
    }
  };



  // Determine available tabs
  const getTabs = () => {
    if (userData.role === "general_user") {
      return [{ id: "reports", label: "Reports" }, { id: "posts", label: "Posts" }];
    } else {
      return [{ id: "posts", label: "Posts" }, { id: "rescues", label: "Rescues" }, { id: "reports", label: "Reports" }];
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <BackButton onPress={() => router.back()} />

        <Text style={styles.headerTitle}>PROFILE</Text>

        <TouchableOpacity onPress={() => setMenuVisible(true)}>
          <Ionicons name="ellipsis-vertical" size={24} color="#1F2937" />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BRAND_COLOR} />
        }
      >
        {/* Profile Details Card */}
        <View style={styles.profileCard}>
          <TouchableOpacity
            style={styles.avatarContainer}
            onPress={() => setIsViewerVisible(true)}
          >
            <Image
              source={
                profileData?.profileImage || userData?.avatar
                  ? { uri: profileData.profileImage || userData.avatar }
                  : require("../../assets/images/default-avatar.jpg")
              }
              style={styles.avatar}
            />
          </TouchableOpacity>

          <View style={styles.roleBadgeContainer}>
            <View style={[styles.roleBadge, { backgroundColor: userData.role === 'general_user' ? '#888' : BRAND_COLOR }]}>
              <Text style={styles.roleBadgeText}>{getRoleLabel(userData.role)}</Text>
            </View>
          </View>

          <View style={styles.nameRow}>
            <Text style={styles.name}>
              {userData.role === "ngo" && profileData?.orgName ? profileData.orgName : userData.name}
            </Text>
            {userData.isApproved && (
              <Ionicons name="checkmark-circle" size={20} color="#1DA1F2" style={{ marginLeft: 4 }} />
            )}
          </View>

          {userData.role === "ngo" && profileData?.location ? (
            <View style={styles.locationContainer}>
              <Ionicons name="location-outline" size={14} color="#6B7280" />
              <Text style={styles.location}>{profileData.location}</Text>
            </View>
          ) : null}

          {userData.role === "vet" && profileData?.clinicAddress ? (
            <View style={styles.locationContainer}>
              <Ionicons name="location-outline" size={14} color="#6B7280" />
              <Text style={styles.location}>{profileData.clinicAddress}</Text>
            </View>
          ) : null}

          {/* Role specific info */}
          {userData.role === "volunteer" && profileData?.serviceArea ? (
            <Text style={styles.metaInfo}>Service Area: {profileData.serviceArea}</Text>
          ) : null}
          {userData.role === "vet" && profileData?.clinicName ? (
            <View style={styles.tagsContainer}>
              <View style={styles.tagBadge}>
                <Ionicons name="business-outline" size={12} color="#4B5563" />
                <Text style={styles.tagText} numberOfLines={1}>
                  {profileData.clinicName}
                </Text>
              </View>
            </View>
          ) : null}


          <Text style={styles.bio}>{profileData?.bio || "No bio available."}</Text>

          <Text style={styles.joinDate}>
            MEMBER SINCE {userData.createdAt ? new Date(userData.createdAt).getFullYear() : "2026"}
          </Text>

          {/* Action Buttons */}
          <View style={styles.actionsContainer}>
            <TouchableOpacity
              style={[styles.msgButton, permissions?.canMessage === false && styles.disabledButton]}
              onPress={handleMessage}
              disabled={permissions?.canMessage === false}
            >
              {permissions?.canMessage === false ? (
                <Feather name="lock" size={16} color="#FFF" style={{ marginRight: 6 }} />
              ) : (
                <Ionicons name="chatbubble-ellipses-outline" size={18} color="#FFF" style={{ marginRight: 6 }} />
              )}
              <Text style={styles.msgButtonText}>Message</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.callButton, permissions?.canCall === false && styles.disabledButton]}
              onPress={handleCall}
              disabled={permissions?.canCall === false}
            >
              {permissions?.canCall === false ? (
                <Feather name="lock" size={16} color="#9CA3AF" style={{ marginRight: 6 }} />
              ) : (
                <Ionicons name="call-outline" size={18} color="#9CA3AF" style={{ marginRight: 6 }} />
              )}
              <Text style={styles.callButtonText}>Call</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats Row */}
        <ProfileStatsRow stats={
          userData.role === "general_user"
            ? [
              { value: statsData?.reportsCount !== undefined ? statsData.reportsCount : reports.length, label: "REPORTS" },
              { value: statsData?.postsCount !== undefined ? statsData.postsCount : posts.length, label: "POSTS" },
            ]
            : [
              { value: statsData?.postsCount !== undefined ? statsData.postsCount : posts.length, label: "POSTS" },
              { value: statsData?.rescuesCompleted !== undefined ? statsData.rescuesCompleted : rescues.length, label: "RESCUES" },
              { value: statsData?.reportsCount !== undefined ? statsData.reportsCount : reports.length, label: "REPORTS" },
              ...((userData.role === "ngo" || userData.role === "vet") && statsData?.totalDonations !== undefined 
                ? [{ value: `Rs. ${statsData.totalDonations}`, label: "DONATIONS" }] 
                : [])
            ]
        } />

        {/* Tabs Bar */}
        <View style={styles.tabContainer}>
          {getTabs().map((tab) => (
            <TouchableOpacity
              key={tab.id}
              style={[
                styles.tabButton,
                activeTab === tab.id && styles.activeTabButton,
              ]}
              onPress={() => setActiveTab(tab.id)}
            >
              <Text
                style={[
                  styles.tabLabel,
                  activeTab === tab.id && styles.activeTabLabel,
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab Content */}
        <View style={styles.tabContentContainer}>
          {activeTab === "posts" && (
            posts.length > 0 ? (
              posts.map((post) => (
                <PostPreviewCard
                  key={post._id}
                  title={post.title || "Community Post"}
                  image={post.imageUrl || undefined}
                  likes={post.likeCount ?? post.likes ?? 0}
                  comments={post.commentCount ?? post.comments ?? 0}
                  time={post.createdAt ? new Date(post.createdAt).toLocaleDateString() : ""}
                  onPress={() => router.push({ pathname: "/community-feed/CommunityPostView", params: { id: post._id } })}
                />
              ))
            ) : (
              <EmptyStateCard
                icon="paw"
                title="No posts yet"
                subtitle="This user hasn't published any community posts."
              />
            )
          )}

          {activeTab === "reports" && (
            (isOwner ? reports : reports.filter((r: any) => !r.anonymous && r.animalType !== "Anonymous Report")).length > 0 ? (
              <View>
                {/* ACTIVE CASES */}
                <Text style={styles.subSectionTitle}>Active Cases</Text>
                {(isOwner ? reports : reports.filter((r: any) => !r.anonymous && r.animalType !== "Anonymous Report")).filter((r: any) => (r.status || "").toLowerCase() !== "completed").length > 0 ? (
                  (isOwner ? reports : reports.filter((r: any) => !r.anonymous && r.animalType !== "Anonymous Report")).filter((r: any) => (r.status || "").toLowerCase() !== "completed").map((report) => (
                    <ReportPreviewCard
                      key={report._id}
                      title={`${report.animalType} (${report.caseId || report.breed || "Case"})${report.anonymous ? " • Anonymous" : ""}`}
                      date={new Date(report.createdAt).toLocaleDateString()}
                      status={report.status}
                      image={report.photos && report.photos.length > 0 ? report.photos[0] : "https://via.placeholder.com/150"}
                      summary={report.summary || report.description || report.notes}
                      caseId={report.caseId}
                      onPress={() => {
                        if (report.caseId) {
                          router.push({
                            pathname: "/reporting/CaseSummary",
                            params: { caseId: report.caseId },
                          });
                        }
                      }}
                      onTrackPress={
                        isOwner
                          ? () => {
                              router.push({
                                pathname: "/live-tracking/[requestId]",
                                params: {
                                  requestId: report.caseId || report._id,
                                  fromProfile: "true",
                                  source: "profile",
                                },
                              });
                            }
                          : undefined
                      }
                    />
                  ))
                ) : (
                  <Text style={styles.noActiveText}>No active cases right now.</Text>
                )}

                {/* COMPLETED CASES */}
                <Text style={[styles.subSectionTitle, { marginTop: 16 }]}>Completed Cases</Text>
                {(isOwner ? reports : reports.filter((r: any) => !r.anonymous && r.animalType !== "Anonymous Report")).filter((r: any) => (r.status || "").toLowerCase() === "completed").length > 0 ? (
                  (isOwner ? reports : reports.filter((r: any) => !r.anonymous && r.animalType !== "Anonymous Report")).filter((r: any) => (r.status || "").toLowerCase() === "completed").map((report) => (
                    <ReportPreviewCard
                      key={report._id}
                      title={`${report.animalType} (${report.caseId || report.breed || "Case"})${report.anonymous ? " • Anonymous" : ""}`}
                      date={new Date(report.createdAt).toLocaleDateString()}
                      status={report.status}
                      image={report.photos && report.photos.length > 0 ? report.photos[0] : "https://via.placeholder.com/150"}
                      summary={report.summary || report.description || report.notes}
                      caseId={report.caseId}
                      onPress={() => {
                        if (report.caseId) {
                          router.push({
                            pathname: "/reporting/CaseSummary",
                            params: { caseId: report.caseId },
                          });
                        }
                      }}
                    />
                  ))
                ) : (
                  <Text style={styles.noActiveText}>No completed cases yet.</Text>
                )}
              </View>
            ) : (
              <EmptyStateCard
                icon="document-text-outline"
                title="No reports yet"
                subtitle="This user hasn't submitted any reports."
              />
            )
          )}

          {activeTab === "rescues" && (
            rescues.length > 0 ? (
              <View>
                {/* ACTIVE RESCUES */}
                <Text style={styles.subSectionTitle}>Active Rescues</Text>
                {rescues.filter((r: any) => !["completed", "ready for adoption", "ready_for_adoption", "closed", "adopted"].includes((r.status || "").toLowerCase().trim())).length > 0 ? (
                  rescues.filter((r: any) => !["completed", "ready for adoption", "ready_for_adoption", "closed", "adopted"].includes((r.status || "").toLowerCase().trim())).map((rescue: any) => (
                    <ReportPreviewCard
                      key={rescue._id || rescue.caseId}
                      title={`${rescue.animalType || "Rescue"} (${rescue.caseId || "Case"})`}
                      date={rescue.createdAt ? new Date(rescue.createdAt).toLocaleDateString() : ""}
                      status={rescue.status ? rescue.status.toUpperCase() : "ACTIVE"}
                      image={rescue.photos && rescue.photos.length > 0 ? rescue.photos[0] : (rescue.photoUrl || "https://via.placeholder.com/150")}
                      summary={rescue.summary || rescue.description}
                      onPress={() => {
                        router.push({
                          pathname: "/reporting/CaseSummary",
                          params: { caseId: rescue.caseId || rescue._id },
                        });
                      }}
                    />
                  ))
                ) : (
                  <Text style={styles.noActiveText}>No active rescue operations right now.</Text>
                )}

                {/* 📜 COMPLETED CASES */}
                <Text style={[styles.subSectionTitle, { marginTop: 16 }]}>Completed Cases</Text>
                {rescues.filter((r: any) => ["completed", "ready for adoption", "ready_for_adoption", "closed", "adopted"].includes((r.status || "").toLowerCase().trim())).length > 0 ? (
                  rescues.filter((r: any) => ["completed", "ready for adoption", "ready_for_adoption", "closed", "adopted"].includes((r.status || "").toLowerCase().trim())).map((rescue: any) => (
                    <ReportPreviewCard
                      key={rescue._id || rescue.caseId}
                      title={`${rescue.animalType || "Rescue"} (${rescue.caseId || "Case"})`}
                      date={rescue.createdAt ? new Date(rescue.createdAt).toLocaleDateString() : ""}
                      status={rescue.status ? rescue.status.toUpperCase() : "COMPLETED"}
                      image={rescue.photos && rescue.photos.length > 0 ? rescue.photos[0] : (rescue.photoUrl || "https://via.placeholder.com/150")}
                      summary={rescue.summary || rescue.description}
                      onPress={() => {
                        router.push({
                          pathname: "/reporting/CaseSummary",
                          params: { caseId: rescue.caseId || rescue._id },
                        });
                      }}
                    />
                  ))
                ) : (
                  <Text style={styles.noActiveText}>No completed rescue operations yet.</Text>
                )}
              </View>
            ) : (
              <EmptyStateCard
                icon="checkmark-done-circle-outline"
                title="No rescues yet"
                subtitle="This user hasn't participated in any rescue operations."
              />
            )
          )}
        </View>
      </ScrollView>

      {/* Action Dropdown Menu */}
      <DropdownMenu
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        options={[
          {
            label: "Share Profile",
            icon: "share-social-outline",
            onPress: handleShare,
          },
          {
            label: "Copy Profile Link",
            icon: "copy-outline",
            onPress: handleCopyLink,
          },
          {
            label: "Report User",
            icon: "alert-circle-outline",
            onPress: () => setReportModalVisible(true),
            destructive: true,
          },
          {
            label: "Block/Unblock User",
            icon: "ban-outline",
            onPress: handleBlockUser,
            destructive: true,
          },
        ]}
      />

      {/* Report User Form Sheet */}
      <ReportUserModal
        visible={reportModalVisible}
        onClose={() => setReportModalVisible(false)}
        onSubmit={handleReportSubmit}
      />

      <ImageViewer
        imageUrl={
          profileData?.profileImage || userData?.avatar
            ? profileData.profileImage || userData.avatar
            : require("../../assets/images/default-avatar.jpg")
        }
        visible={isViewerVisible}
        onClose={() => setIsViewerVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAFAFA",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FAFAFA",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    backgroundColor: "#FFFFFF",
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 1.2,
    color: BRAND_COLOR,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  profileCard: {
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    paddingTop: 24,
    paddingBottom: 4,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  avatarContainer: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 2,
    borderColor: BRAND_COLOR,
    padding: 3,
    backgroundColor: "#FFF4E6",
  },
  avatar: {
    width: "100%",
    height: "100%",
    borderRadius: 42,
  },
  roleBadgeContainer: {
    flexDirection: "row",
    marginTop: -10,
    marginBottom: 8,
  },
  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FFFFFF",
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  name: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111827",
  },
  locationContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
    gap: 3,
  },
  location: {
    fontSize: 13,
    color: "#6B7280",
  },
  metaInfo: {
    fontSize: 13,
    color: "#4B5563",
    fontWeight: "500",
    marginTop: 2,
  },
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
    marginTop: 8,
    paddingHorizontal: 20,
  },
  tagBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
  },
  tagText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#4B5563",
    flexShrink: 1,
  },
  bio: {
    fontSize: 14,
    color: "#4B5563",
    textAlign: "center",
    lineHeight: 20,
    marginVertical: 12,
    paddingHorizontal: 20,
  },
  joinDate: {
    fontSize: 11,
    fontWeight: "600",
    color: BRAND_COLOR,
    letterSpacing: 0.5,
    marginBottom: 16,
  },
  actionsContainer: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
    justifyContent: "center",
  },
  msgButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BRAND_COLOR,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 10,
    flex: 1,
    maxWidth: 160,
  },
  msgButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  disabledButton: {
    opacity: 0.5,
  },
  callButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 10,
    flex: 1,
    maxWidth: 160,
    opacity: 0.6,
  },
  callButtonText: {
    color: "#55575bff",
    fontSize: 14,
    fontWeight: "600",
  },

  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  activeTabButton: {
    borderBottomColor: BRAND_COLOR,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#9CA3AF",
  },
  activeTabLabel: {
    color: BRAND_COLOR,
  },
  tabContentContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  subSectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#444",
    marginBottom: 10,
    marginLeft: 4,
  },
  noActiveText: {
    fontSize: 13,
    color: "#888",
    fontStyle: "italic",
    marginLeft: 4,
    marginBottom: 10,
  },
});
