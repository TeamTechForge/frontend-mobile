// Root layout for the app, defining the navigation stack and global providers.
import { Stack, useRouter, useSegments } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";
import { AuthProvider, useAuth } from "../contexts/AuthContext";
import { SocketProvider } from "../contexts/SocketContext";
import { CallProvider } from "../contexts/CallContext";
import { NotificationProvider, useNotification } from "../contexts/NotificationContext";
import { useFonts } from "expo-font";
import { AlertProvider } from "../components/GlobalAlert";
import { SafeAreaProvider } from "react-native-safe-area-context";

function InitialLayout() {
  const { user, token, isLoading } = useAuth();
  const segments = useSegments() as any;
  const router = useRouter();
  const { addNotification } = useNotification();
  const [hasCheckedCompletion, setHasCheckedCompletion] = useState(false);
  const handledNotificationIdsRef = useRef<Set<string>>(new Set());

  // Check if newly approved NGOs/Vets need to be marked as having seen the completion screen
  useEffect(() => {
    if (user && (user.role === "ngo" || user.role === "vet") && user.profileStatus === "Verified") {
      SecureStore.getItemAsync(`seenCompletion_${user._id}`).then((seen) => {
        if (!seen) {
          SecureStore.setItemAsync(`seenCompletion_${user._id}`, "true");
        }
        setHasCheckedCompletion(true);
      });
    } else {
      setHasCheckedCompletion(true);
    }
  }, [user]);

  useEffect(() => {
    if (isLoading || !hasCheckedCompletion) return;

    const inAuthGroup = segments[0] === "auth";
    const onWelcomeScreen = segments.length === 0 || segments[0] === "index";
    const onAllowedAuthScreen = segments[1] === "Login" || segments[1] === "Register" || segments[1] === "ForgotPasswordScreen" || segments[1] === "TermsPrivacyScreen" || segments[1] === "Welcome";

    if (!token || !user) {
      // Force user to welcome index if they are not on welcome index or allowed auth screens
      if (!onWelcomeScreen && !onAllowedAuthScreen) {
        router.replace("/");
      }
    } else {
      // User is authenticated
      if (!user.profileCompleted) {
        const seg = segments[1]?.toLowerCase();
        const onRoleSelection = seg === "roleselection" || seg === "rescuertypeselection";
        if (!user.roleSelected) {
          if (!onRoleSelection) {
            router.replace("/auth/RoleSelection");
          }
        } else {
          // If they explicitly navigate back to RoleSelection or RescuerTypeSelection to change their role, allow it
          if (onRoleSelection) {
            // Do nothing, let them stay on the selection screen
          } else if (user.role === "ngo" && segments[1] !== "NgoProfileSetup") {
            router.replace("/auth/NgoProfileSetup");
          } else if (user.role === "vet" && segments[1] !== "VetProfileSetup") {
            router.replace("/auth/VetProfileSetup");
          } else if (user.role === "volunteer" && segments[1] !== "VolunteerProfileSetup") {
            router.replace("/auth/VolunteerProfileSetup");
          } else if (user.role === "general_user" && segments[1] !== "ReporterProfileSetup") {
            router.replace("/auth/ReporterProfileSetup");
          }
        }
      } else {
        // Profile is completed
        const needsApproval = user.role === "ngo" || user.role === "vet";
        const isApproved = user.profileStatus === "Verified";

        if (needsApproval && !isApproved) {
          const onProfileSetup = segments[1] === "NgoProfileSetup" || segments[1] === "VetProfileSetup";
          const isAllowedScreen = segments[1] === "VerificationPending" ||
            segments[1] === "VerificationRejected" ||
            segments[1] === "CompletedProfileSetup" ||
            (user.profileStatus === "Rejected" && onProfileSetup);
          const isNotificationsScreen = segments[0] === "modals" && segments[1] === "Notifications";
          const isSupportScreen = segments[0] === "profile" && (segments[1] === "HelpSupport" || segments[1] === "ContactSupport" || segments[1] === "contactSupport");

          if (!isAllowedScreen && !isNotificationsScreen && !isSupportScreen) {
            if (user.profileStatus === "Rejected") {
              router.replace("/auth/VerificationRejected");
            } else {
              router.replace("/auth/VerificationPending");
            }
          }
        } else {
          // Redirect to home if they are sitting on guest/pending/setup routes or index
          if (inAuthGroup || onWelcomeScreen) {
            const onCompletedProfileSetup = segments[1] === "CompletedProfileSetup";
            const onTermsPrivacyScreen = segments[1] === "TermsPrivacyScreen";
            const seg = segments[1]?.toLowerCase();
            const onSetupScreens = seg === "reporterprofilesetup" || 
                                   seg === "volunteerprofilesetup" || 
                                   seg === "ngoprofilesetup" || 
                                   seg === "vetprofilesetup";

            // If they are on a setup screen, let the component handle its own navigation
            if (!onCompletedProfileSetup && !onTermsPrivacyScreen && !onSetupScreens) {
              router.replace("/(tabs)/Home");
            }
          }
        }
      }
    }
  }, [user, isLoading, segments, token, hasCheckedCompletion]);

  // ─── Push Notifications Setup (Optional - only on native build) ───
  useEffect(() => {
    if (!token || !user) return;

    let cancelled = false;
    let removeForegroundListener: (() => void) | undefined;
    let removeResponseListener: (() => void) | undefined;

    const setupPushNotifications = async () => {
      try {
        // Lazy load push notification service (only available on native builds)
        const {
          pushNotificationService,
          VIEW_CASE_ACTION_ID,
        } = await import("../services/pushNotificationService");

        await pushNotificationService.ensureAuthenticatedTokenRegistered();
        if (cancelled) return;

        removeForegroundListener = pushNotificationService.listenForNotifications((notification) => {
          // Handle incoming push notification
          if (notification.request.content.data) {
            const data = notification.request.content.data as Record<string, any>;
            const title = notification.request.content.title || "Notification";
            const message = notification.request.content.body || "";

            // Present OS banner alert natively
            void pushNotificationService.presentLocalNotification(title, message, data);

            addNotification({
              _id: `push-${Date.now()}`,
              userId: user._id || "",
              title,
              message,
              type: (data.type as any) || "info",
              read: false,
              caseId: typeof data.caseId === "string" ? data.caseId : undefined,
              rescueRequestId: typeof data.rescueRequestId === "string" ? data.rescueRequestId : undefined,
              event: typeof data.event === "string" ? data.event : undefined,
              status: typeof data.status === "string" ? data.status : undefined,
              animalType: typeof data.animalType === "string" ? data.animalType : undefined,
              assignedRescuerName: typeof data.assignedRescuerName === "string" ? data.assignedRescuerName : undefined,
              action: typeof data.action === "string" ? data.action : undefined,
              createdAt: new Date().toISOString(),
            });
          }
        });

        const handleResponse = (response: import("expo-notifications").NotificationResponse) => {
          const notification = response.notification;
          const notificationId = notification.request.identifier;
          if (handledNotificationIdsRef.current.has(notificationId)) return;

          const data = notification.request.content.data as Record<string, any>;
          const title = notification.request.content.title || "";
          const caseId = typeof data.caseId === "string" ? data.caseId : "";
          const requestId = typeof data.rescueRequestId === "string" ? data.rescueRequestId : "";
          const isCaseUpdate = data.event === "rescue_accepted" || data.event === "case_status_updated";
          const isViewAction = response.actionIdentifier === VIEW_CASE_ACTION_ID;

          if ((isCaseUpdate || isViewAction) && caseId) {
            handledNotificationIdsRef.current.add(notificationId);
            router.push({ pathname: "/reporting/CaseDetails", params: { caseId } } as never);
          } else if (title === "New Rescue Request" || title.includes("Rescue Request") || (requestId && !caseId && !isCaseUpdate)) {
            // For rescue request notifications: show notification only, do nothing when clicked
            handledNotificationIdsRef.current.add(notificationId);
          } else if ((title.includes("Discussion") || title.includes("Reply")) && caseId) {
            handledNotificationIdsRef.current.add(notificationId);
            router.push({ pathname: "/discussion-thread/[id]", params: { id: caseId } } as never);
          }

          pushNotificationService.clearLastNotificationResponse();
        };

        removeResponseListener = pushNotificationService.listenForNotificationResponses(handleResponse);

        const lastResponse = pushNotificationService.getLastNotificationResponse();
        if (lastResponse) {
          handleResponse(lastResponse);
        }
      } catch (error) {
        // Push notifications not available (normal in Expo Go)
        console.log("[PUSH] Push notifications not available:", (error as any)?.message);
      }
    };

    setupPushNotifications();
    return () => {
      cancelled = true;
      removeForegroundListener?.();
      removeResponseListener?.();
    };
  }, [token, user, addNotification, router]);

  // ─── Global Rescue Request Listener ───
  // `seenRequestIdsRef` tracks which request IDs have already been shown to this
  // rescuer. It is persisted to SecureStore so it survives app restarts — once a
  // request has been dismissed or cancelled it will never notify again.
  const seenRequestIdsRef = useRef<Set<string>>(new Set());
  const SEEN_KEY = user ? `seenRescueRequests_${user._id}` : null;

  // ── Dismissible in-app rescue notification (replaces Alert.alert) ──
  // null = hidden; object = visible overlay.
  // This can be set to null instantly when rescue_cancelled arrives —
  // unlike Alert.alert() which cannot be dismissed programmatically.
  type RescueNotif = { reqId: string; reporterName: string; animalType: string };
  const [rescueNotif, setRescueNotif] = useState<RescueNotif | null>(null);

  // On mount: seed the in-memory set from SecureStore so previously-seen
  // (including cancelled) request IDs are never re-shown after reopening.
  useEffect(() => {
    if (!SEEN_KEY) return;
    SecureStore.getItemAsync(SEEN_KEY).then((raw) => {
      if (!raw) return;
      try {
        const ids: string[] = JSON.parse(raw);
        ids.forEach((id) => seenRequestIdsRef.current.add(id));
      } catch {
        // ignore malformed stored value
      }
    }).catch(() => {});
  }, [SEEN_KEY]);

  // Helper: add a request ID to both the in-memory set and SecureStore.
  const markRequestSeen = (reqId: string) => {
    seenRequestIdsRef.current.add(reqId);
    if (!SEEN_KEY) return;
    // Persist asynchronously — fire and forget, non-blocking
    SecureStore.getItemAsync(SEEN_KEY).then((raw) => {
      let ids: string[] = [];
      try { ids = raw ? JSON.parse(raw) : []; } catch { ids = []; }
      if (!ids.includes(reqId)) {
        ids.push(reqId);
        // Cap to 50 entries to prevent unbounded growth
        if (ids.length > 50) ids = ids.slice(-50);
        SecureStore.setItemAsync(SEEN_KEY, JSON.stringify(ids)).catch(() => {});
      }
    }).catch(() => {});
  };

  // Polling: check for new pending rescue requests every 5 s.
  useEffect(() => {
    if (!token || !user) return;
    const isRescuer = user.role === "volunteer" || user.role === "ngo" || user.role === "vet" || user.role === "rescuer";
    if (!isRescuer) return;

    const checkActiveRequest = async () => {
      try {
        const { API_URL } = require("../constants/config.constants");
        const response = await fetch(`${API_URL}/rescue/active-request`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) return;

        const data: any = await response.json();
        const reqId = data.request?.rescueRequestId || data.request?._id;
        if (reqId && !seenRequestIdsRef.current.has(String(reqId))) {
          // Mark as seen immediately (persisted) — prevents re-notification
          // on the next tick or after an app restart.
          markRequestSeen(String(reqId));

          const reporterName = data.request?.reporterName || data.request?.reporter?.name || "A reporter";
          const animalType = data.request?.animalType || "stray animal";

          // Show the dismissible in-app overlay instead of Alert.alert().
          // Alert.alert() is a system dialog that cannot be closed by code —
          // this Modal can be hidden instantly when rescue_cancelled fires.
          setRescueNotif({ reqId: String(reqId), reporterName, animalType });
        }
      } catch (err) {
        console.error("Global active request check failed:", err);
      }
    };

    const interval = setInterval(checkActiveRequest, 5000);
    return () => clearInterval(interval);
  }, [token, user]);

  // Socket: listen for rescue_cancelled so the overlay is hidden the instant
  // the reporter cancels — no waiting, no user interaction required.
  useEffect(() => {
    const reqId = rescueNotif?.reqId;
    if (!reqId) return;

    const { BASE_URL } = require("../constants/config.constants");
    const { io: ioClient } = require("socket.io-client");

    const rescueSocket = ioClient(`${BASE_URL}/rescue`, {
      transports: ["websocket"],
      autoConnect: true,
      reconnection: true,
    });

    rescueSocket.on("connect", () => {
      rescueSocket.emit("join_rescue", String(reqId));
    });

    rescueSocket.on("rescue_cancelled", () => {
      // Instantly hide the notification overlay
      setRescueNotif(null);
    });

    return () => {
      rescueSocket.disconnect();
    };
  }, [rescueNotif?.reqId]);


  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff" }}>
        <ActivityIndicator size="large" color="#F5A623" />
      </View>
    );
  }

  return (
    <>
      <Stack screenOptions={{ headerShown: false }} />

      {/* ── Dismissible rescue request notification overlay ────────────────────
       *  Replaces Alert.alert() so it can be hidden programmatically when the
       *  reporter cancels the request (rescue_cancelled socket event).           */}
      <Modal
        visible={rescueNotif !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setRescueNotif(null)}
      >
        <View style={overlayStyles.backdrop}>
          <View style={overlayStyles.card}>
            <View style={{ marginBottom: 12 }}>
              <Ionicons name="notifications-circle" size={48} color="#F5A623" />
            </View>
            <Text style={overlayStyles.title}>New Rescue Request</Text>
            <Text style={overlayStyles.body}>
              {rescueNotif?.reporterName ?? "A reporter"} reported a{" "}
              {rescueNotif?.animalType ?? "stray animal"} needing rescue near your location.
            </Text>
            <TouchableOpacity
              style={overlayStyles.btn}
              activeOpacity={0.8}
              onPress={() => {
                const id = rescueNotif?.reqId;
                setRescueNotif(null);
                if (id) router.push(`/rescue-details/${id}`);
              }}
            >
              <Text style={overlayStyles.btnText}>View Case Details</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const overlayStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 28,
    width: "100%",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 10,
  },
  emoji: {
    fontSize: 40,
    marginBottom: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 12,
    textAlign: "center",
  },
  body: {
    fontSize: 14,
    color: "#444",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  btn: {
    backgroundColor: "#F5A623",
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 32,
    width: "100%",
    alignItems: "center",
  },
  btnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
});



export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    "Inter-Regular": require("../assets/fonts/Inter-Regular.ttf"),
    "Inter-Medium": require("../assets/fonts/Inter-Medium.ttf"),
    "Inter-SemiBold": require("../assets/fonts/Inter-SemiBold.ttf"),
    "Inter-Bold": require("../assets/fonts/Inter-Bold.ttf"),
  });

  // Set global default font once fonts are loaded
  useEffect(() => {
    if (fontsLoaded) {
      const customTextProps = { style: { fontFamily: "Inter-Regular" } };

      // For older RN / React versions
      if ((Text as any).render) {
        const oldTextRender = (Text as any).render;
        (Text as any).render = function (...args: any) {
          const origin = oldTextRender.call(this, ...args);
          return React.cloneElement(origin, {
            style: [{ fontFamily: "Inter-Regular" }, origin.props.style],
          });
        };
      } else {
        // For React Native 0.74+ / React 19
        (Text as any).defaultProps = (Text as any).defaultProps || {};
        (Text as any).defaultProps.style = [
          (Text as any).defaultProps.style,
          { fontFamily: "Inter-Regular" },
        ];
      }

      if ((TextInput as any).render) {
        const oldTextInputRender = (TextInput as any).render;
        (TextInput as any).render = function (...args: any) {
          const origin = oldTextInputRender.call(this, ...args);
          return React.cloneElement(origin, {
            style: [{ fontFamily: "Inter-Regular" }, origin.props.style],
          });
        };
      } else {
        (TextInput as any).defaultProps = (TextInput as any).defaultProps || {};
        (TextInput as any).defaultProps.style = [
          (TextInput as any).defaultProps.style,
          { fontFamily: "Inter-Regular" },
        ];
      }
    }
  }, [fontsLoaded]);

  // Wait until fonts load
  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff" }}>
        <ActivityIndicator size="large" color="#F5A623" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <SocketProvider>
          <NotificationProvider>
            <CallProvider>
              <AlertProvider>
                <InitialLayout />
              </AlertProvider>
            </CallProvider>
          </NotificationProvider>
        </SocketProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
