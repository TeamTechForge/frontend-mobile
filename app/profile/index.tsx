import { Feather, Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useCallback, useState, useEffect } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { API_URL } from "../../constants/config.constants";

import EmptyStateCard from "../../components/profile/EmptyStateCard";
import PostPreviewCard from "../../components/profile/PostPreviewCard";
import ProfileHeaderCard from "../../components/profile/ProfileHeaderCard";
import ProfileMenuDrawer from "../../components/profile/ProfileMenuDrawer";
import ProfileStatsRow from "../../components/profile/ProfileStatsRow";
import ProfileTabBar, { TabKey, TabItem } from "../../components/profile/ProfileTabBar";
import ReportPreviewCard from "../../components/profile/ReportPreviewCard";
import SavedPreviewCard from "../../components/profile/SavedPreviewCard";
import { useAuth } from "../../contexts/AuthContext";
import { getCaseStatusUpdateRoute } from "../../utils/profileRoutes";
import { CommunityPost, getMyCommunityPosts, getSavedCommunityPosts } from "../../services/communityService";

const BRAND_COLOR = "#F5A623";

export default function ProfileScreen() {
  const router = useRouter();
  const { logout } = useAuth();

  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [rescues, setRescues] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [savedItems, setSavedItems] = useState<CommunityPost[]>([]);
  const [totalDonations, setTotalDonations] = useState(0);
  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);
  const [failingRescueId, setFailingRescueId] = useState<string | null>(null);

  const [totalReportsCount, setTotalReportsCount] = useState<number | null>(null);
  const [totalPostsCount, setTotalPostsCount] = useState<number | null>(null);
  const fetchData = useCallback(async () => {
    try {
      const token = await SecureStore.getItemAsync("authToken");
      if (!token) {
        router.replace("/auth/Login");
        return;
      }

      const userRes = await fetch(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const userData = (await userRes.json()) as any;
      if (userRes.ok) setUser(userData);

      const profileRes = await fetch(`${API_URL}/profiles/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const profileData = (await profileRes.json()) as any;
      if (profileRes.ok) {
        setProfile(profileData);
        // If role supports donations
        if (userData?.role === 'ngo' || userData?.role === 'vet') {
          if (profileData && profileData._id) {
            const donationRes = await fetch(`${API_URL}/donations/total/${profileData._id}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (donationRes.ok) {
              const donationData: any = await donationRes.json();
              setTotalDonations(donationData.total || 0);
            }
          }
        }
      }

      const userId = userData._id || userData.id;
      if (userId) {
        // Fetch rescues for roles that need them
        if (userData?.role !== 'general_user') {
          const rescuesRes = await fetch(`${API_URL}/rescues/my-rescues?userId=${userId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (rescuesRes.ok) {
            const rescuesData = (await rescuesRes.json()) as any;
            setRescues(rescuesData);
          }
        }

        const reportsRes = await fetch(`${API_URL}/users/${userId}/reports`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (reportsRes.ok) {
          const reportsData = (await reportsRes.json()) as any;
          setReports(reportsData);
        }

        const [postsData, savedPostsData] = await Promise.all([
          getMyCommunityPosts(),
          getSavedCommunityPosts(),
        ]);
        setPosts(postsData);
        setSavedItems(savedPostsData);
        setTotalPostsCount(postsData.length);

        // Fetch user stats (includes all reports and posts including anonymous)
        const publicProfRes = await fetch(`${API_URL}/users/${userId}/public-profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (publicProfRes.ok) {
          const publicProfData = (await publicProfRes.json()) as any;
          if (publicProfData?.stats?.reportsCount !== undefined) {
            setTotalReportsCount(publicProfData.stats.reportsCount);
          }
        }
      }
    } catch (error) {
      console.error("Fetch profile error:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      void fetchData();
    }, [fetchData])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const openCaseStatusUpdate = (caseId: string) => {
    router.push(getCaseStatusUpdateRoute(caseId));
  };

  const markRescueFailed = (rescue: any) => {
    const rescueId = rescue.rescueRequestId || rescue._id || rescue.id || rescue.caseId;
    if (!rescueId) return;

    Alert.alert(
      "Mark rescue as failed?",
      "This closes the rescue and records it as failed in rescue history.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Mark Failed",
          style: "destructive",
          onPress: async () => {
            try {
              setFailingRescueId(String(rescueId));
              const token = await SecureStore.getItemAsync("authToken");
              const response = await fetch(`${API_URL}/rescue/request/${encodeURIComponent(String(rescueId))}/fail`, {
                method: "PATCH",
                headers: { Authorization: `Bearer ${token}` },
              });
              const result = await response.json();
              if (!response.ok) {
                throw new Error(result?.error || result?.message || "Could not mark this rescue as failed.");
              }
              await fetchData();
            } catch (error: any) {
              Alert.alert("Update Failed", error?.message || "Could not mark this rescue as failed.");
            } finally {
              setFailingRescueId(null);
            }
          },
        },
      ]
    );
  };

  // Role-based logic
  const isGeneralUser = user?.role === 'general_user';
  const isVolunteer = user?.role === 'volunteer';
  const isNgo = user?.role === 'ngo';
  const isVet = user?.role === 'vet';

  const stats = [
    { value: totalPostsCount !== null ? totalPostsCount : posts.length, label: "POSTS" },
    ...(!isGeneralUser ? [{ value: rescues.length, label: "RESCUES" }] : []),
    { value: totalReportsCount !== null ? totalReportsCount : reports.length, label: "REPORTS" },
    ...(isNgo || isVet ? [{ value: "Rs. " + totalDonations, label: "DONATIONS" }] : []),
  ];

  const [activeTab, setActiveTab] = useState<TabKey>("posts");
  const [menuVisible, setMenuVisible] = useState(false);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={BRAND_COLOR} />
      </View>
    );
  }

  // Dynamic header and profile info based on role
  let headerTitle = "MY PROFILE";
  let defaultName = "User";
  let location = profile?.location || "Not set";
  let bio = profile?.bio ? profile.bio : "";

  if (isVolunteer) {
    headerTitle = "VOLUNTEER PROFILE";
    defaultName = "Volunteer";
  } else if (isNgo) {
    headerTitle = "NGO PROFILE";
    defaultName = "NGO";
    if (profile?.orgName) defaultName = profile.orgName;
    
    const extraInfo = [];
    if (profile?.regNumber) extraInfo.push(`Reg No: ${profile.regNumber}`);
    if (profile?.contactPerson) extraInfo.push(`Contact: ${profile.contactPerson}`);
    if (extraInfo.length > 0) bio += (bio ? `\n\n` : "") + extraInfo.join(' | ');
  } else if (isVet) {
    headerTitle = "VET PROFILE";
    defaultName = "Veterinarian";
    location = profile?.clinicAddress || profile?.primaryLocation || location;
    
    const extraInfo = [];
    if (profile?.licenseNumber) extraInfo.push(`License: ${profile.licenseNumber}`);
    if (profile?.clinicName) extraInfo.push(`Clinic: ${profile.clinicName}`);
    if (extraInfo.length > 0) bio += (bio ? `\n\n` : "") + extraInfo.join(' | ');
  }

  if (!bio) bio = "No bio yet.";

  const userData = {
    name: user?.name && isNgo && profile?.orgName ? profile.orgName : (user?.name || defaultName),
    location: location,
    bio: bio,
    memberSince: user?.createdAt ? new Date(user.createdAt).getFullYear().toString() : "2026",
    avatar: profile?.profileImage || user?.avatar ? (profile?.profileImage || user?.avatar) : require("../../assets/images/default-avatar.jpg"),
    cover: require("../../assets/images/default-avatar.jpg"),
  };

  const isRescueRole = !isGeneralUser;

  const tabOptions: TabItem[] = [
    { key: "posts", label: "My Posts" },
    ...(isRescueRole ? [{ key: "rescues" as TabKey, label: "Rescue Cases" }] : []),
    { key: "reports", label: "Reports" },
    { key: "saved", label: "Saved Posts" },
  ];

  // Helper to determine if a rescue case is in completed/history cases section
  const isRescueCompleted = (status?: string) => {
    const s = (status || "").toLowerCase().trim();
    return ["completed", "ready for adoption", "ready_for_adoption", "closed", "adopted"].includes(s);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setMenuVisible(true)}>
          <Feather name="menu" size={20} color="#222" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>{headerTitle}</Text>

        <TouchableOpacity onPress={() => router.push("/modals/Notifications" as any)}>
          <Ionicons name="notifications-outline" size={20} color="#222" />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BRAND_COLOR} />
        }
      >
        <ProfileHeaderCard
          name={userData.name}
          location={userData.location}
          bio={userData.bio}
          memberSince={userData.memberSince}
          avatar={userData.avatar}
          role={user?.role}
          isVerified={user?.isApproved}
          onEditPress={() => router.push("/profile/EditProfile")}
        />

        <ProfileStatsRow stats={stats} />

        <ProfileTabBar activeTab={activeTab} onChange={setActiveTab} tabs={tabOptions} />

        <View style={styles.sectionContent}>
          {activeTab === "posts" && (
            posts.length > 0 ? (
              posts.map((post) => (
                <PostPreviewCard
                  key={post._id}
                  title={post.title || "Untitled"}
                  image={post.imageUrl || undefined}
                  likes={post.likeCount ?? (post as any).likes ?? 0}
                  comments={post.commentCount ?? (post as any).comments ?? 0}
                  time={post.date || post.createdAt || ""}
                  onPress={() => router.push({ pathname: "/community-feed/CommunityPostView", params: { id: post._id } })}
                />
              ))
            ) : (
              <EmptyStateCard
                icon="images-outline"
                title="No posts yet"
                subtitle="Share photos and stories of rescues with the community."
              />
            )
          )}

          {activeTab === "rescues" && isRescueRole && (
            rescues.length > 0 ? (
              <View>
                {/* 📌 ACTIVE CASES */}
                <Text style={styles.subSectionTitle}>Active Cases</Text>
                {rescues.filter((r: any) => !isRescueCompleted(r.status) && (r.status || "").toLowerCase() !== "failed").length > 0 ? (
                  rescues
                    .filter((r: any) => !isRescueCompleted(r.status) && (r.status || "").toLowerCase() !== "failed")
                    .map((rescue: any, index: number) => (
                      <ReportPreviewCard
                        key={rescue.id || rescue._id || `active-${index}`}
                        title={`${rescue.animalType || "Rescue"} (${rescue.caseId || "Case"})`}
                        date={rescue.createdAt ? new Date(rescue.createdAt).toLocaleDateString() : (rescue.date || "")}
                        status={rescue.status}
                        image={rescue.photos && rescue.photos.length > 0 ? rescue.photos[0] : (rescue.photoUrl || "https://via.placeholder.com/150")}
                        summary={rescue.summary || rescue.description}
                        actionText="Update Status"
                        onActionPress={() => openCaseStatusUpdate(rescue.caseId)}
                        onSecondaryActionPress={() => markRescueFailed(rescue)}
                        secondaryActionDisabled={failingRescueId === String(rescue.rescueRequestId || rescue._id || rescue.id || rescue.caseId)}
                        onPress={() =>
                          router.push({
                            pathname: "/rescuer-response/[requestId]" as any,
                            params: {
                              requestId: rescue.rescueRequestId || rescue._id || rescue.caseId,
                              caseId: rescue.caseId,
                            },
                          })
                        }
                      />
                    ))
                ) : (
                  <Text style={styles.noActiveText}>No active rescue cases right now.</Text>
                )}

                {/* COMPLETED CASES */}
                <Text style={[styles.subSectionTitle, { marginTop: 16 }]}>Completed Cases</Text>
                {rescues.filter((r: any) => isRescueCompleted(r.status)).length > 0 ? (
                  rescues
                    .filter((r: any) => isRescueCompleted(r.status))
                    .map((rescue: any, index: number) => (
                      <ReportPreviewCard
                        key={rescue.id || rescue._id || `completed-${index}`}
                        title={`${rescue.animalType || "Rescue"} (${rescue.caseId || "Case"})`}
                        date={rescue.createdAt ? new Date(rescue.createdAt).toLocaleDateString() : (rescue.date || "")}
                        status={rescue.status}
                        image={rescue.photos && rescue.photos.length > 0 ? rescue.photos[0] : (rescue.photoUrl || "https://via.placeholder.com/150")}
                        summary={rescue.summary || rescue.description}
                        onPress={() =>
                          router.push({
                            pathname: "/rescuer-response/[requestId]" as any,
                            params: {
                              requestId: rescue.rescueRequestId || rescue._id || rescue.caseId,
                              caseId: rescue.caseId,
                            },
                          })
                        }
                      />
                    ))
                ) : (
                  <Text style={styles.noActiveText}>No completed rescue cases yet.</Text>
                )}
              </View>
            ) : (
              <EmptyStateCard
                icon="medkit-outline"
                title="No rescues yet."
                subtitle={isVolunteer ? "Your accepted rescue requests will appear here." : "Treatments and medical cases will appear here."}
              />
            )
          )}

          {activeTab === "reports" && (
            reports.length > 0 ? (
              <View>
                {/* 📌 ACTIVE CASES */}
                <Text style={styles.subSectionTitle}>Active Cases</Text>
                {reports.filter((r: any) => (r.status || "").toLowerCase() !== "completed").length > 0 ? (
                  reports.filter((r: any) => (r.status || "").toLowerCase() !== "completed").map((report: any, index: number) => (
                    <ReportPreviewCard
                      key={report._id || report.caseId || `current-${index}`}
                      title={`${report.animalType} (${report.caseId})${report.anonymous ? " • Anonymous" : ""}`}
                      date={new Date(report.createdAt).toLocaleDateString()}
                      status={report.status}
                      image={report.photos && report.photos.length > 0 ? report.photos[0] : "https://via.placeholder.com/150"}
                      caseId={report.caseId}
                      summary={report.summary}
                      onPress={() => {
                        router.push({
                          pathname: "/reporting/CaseDetails",
                          params: { caseId: report.caseId },
                        });
                      }}
                      onTrackPress={() => {
                        const statusLower = (report.status || "").toLowerCase();
                        if (["needs help", "pending", "request sent"].includes(statusLower)) {
                          router.push({
                            pathname: "/request-status",
                            params: { caseId: report.caseId },
                          });
                        } else {
                          router.push({
                            pathname: "/live-tracking/[requestId]",
                            params: {
                              requestId: report.caseId,
                              fromProfile: "true",
                              source: "profile",
                            },
                          });
                        }
                      }}
                    />
                  ))
                ) : (
                  <Text style={styles.noActiveText}>No active rescue cases right now.</Text>
                )}

                {/* 📜 COMPLETED CASES */}
                <Text style={[styles.subSectionTitle, { marginTop: 16 }]}>Completed Cases</Text>
                {reports.filter((r: any) => (r.status || "").toLowerCase() === "completed").length > 0 ? (
                  reports.filter((r: any) => (r.status || "").toLowerCase() === "completed").map((report: any, index: number) => (
                    <ReportPreviewCard
                      key={report._id || report.caseId || `history-${index}`}
                      title={`${report.animalType} (${report.caseId})${report.anonymous ? " • Anonymous" : ""}`}
                      date={new Date(report.createdAt).toLocaleDateString()}
                      status={report.status}
                      image={report.photos && report.photos.length > 0 ? report.photos[0] : "https://via.placeholder.com/150"}
                      caseId={report.caseId}
                      summary={report.summary}
                      onPress={() => {
                        router.push({
                          pathname: "/reporting/CaseDetails",
                          params: { caseId: report.caseId },
                        });
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
                title="You haven't reported anything yet."
                subtitle="Rescue street animals by reporting and view the rescue progress."
              />
            )
          )}

          {activeTab === "saved" && (
            savedItems.length > 0 ? (
              <View style={styles.savedGrid}>
                {savedItems.map((item) => (
                  <SavedPreviewCard
                    key={item._id}
                    title={item.title || "Untitled"}
                    subtitle={item.category || "Community"}
                    image={item.imageUrl || undefined}
                    likes={item.likeCount ?? (item as any).likes ?? 0}
                    comments={item.commentCount ?? (item as any).comments ?? 0}
                    onPress={() => router.push({ pathname: "/community-feed/CommunityPostView", params: { id: item._id } })}
                  />
                ))}
              </View>
            ) : (
              <EmptyStateCard
                icon="bookmark-outline"
                title={isGeneralUser ? "You haven't saved anything yet." : "No saved items yet."}
                subtitle="Save interesting posts or rescue histories to view them later."
              />
            )
          )}
        </View>
      </ScrollView>

      <ProfileMenuDrawer
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        user={{
          name: userData.name,
          avatar: userData.avatar,
          role: user?.role,
          status: profile?.status
        }}
        onAdoptionPress={() => {
          setMenuVisible(false);
          router.push("/adoption-corner/MyPosts");
        }}
        onMyLostFoundPress={() => {
          setMenuVisible(false);
          router.push("/lost-and-found/MyPosts");
        }}
        onProfilePress={() => setMenuVisible(false)}
        onDonationsPress={() => {
          setMenuVisible(false);
          router.push(isNgo || isVet ? "/donate/DonationHub" : "/donate/History");
        }}
        onSettingsPress={() => {
          setMenuVisible(false);
          router.push("/profile/Settings");
        }}
        onLogoutPress={async () => {
          setMenuVisible(false);
          await logout();
          router.replace("/");
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAFAFA",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  header: {
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FAFAFA",
  },
  headerTitle: {
    fontSize: 12,
    letterSpacing: 1.2,
    color: BRAND_COLOR,
    fontWeight: "700",
  },
  sectionContent: {
    paddingTop: 14,
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
  savedGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 12,
  },
  modalBackground: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    width: "85%",
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 20,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#222",
    marginBottom: 12,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: "#EFEFEF",
    borderRadius: 10,
    padding: 12,
    height: 80,
    textAlignVertical: "top",
    marginBottom: 16,
    fontSize: 13,
  },
  modalButtonRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
  modalButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtn: {
    backgroundColor: "#F3F4F6",
  },
  submitBtn: {
    backgroundColor: BRAND_COLOR,
  },
  cancelBtnText: {
    color: "#4B5563",
    fontWeight: "600",
    fontSize: 13,
  },
  submitBtnText: {
    color: "#FFF",
    fontWeight: "600",
    fontSize: 13,
  },
});
