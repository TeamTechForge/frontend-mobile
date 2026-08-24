import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import * as SecureStore from "expo-secure-store";
import { API_URL } from "../constants/config.constants";
import { pushNotificationService } from "../services/pushNotificationService";

export interface Notification {
  _id: string;
  userId: string;
  title: string;
  message: string;
  type: "success" | "error" | "info" | "warning";
  read: boolean;
  rescueRequestId?: string;
  caseId?: string;
  event?: "rescue_accepted" | "case_status_updated" | string;
  postId?: string;
  commentId?: string;
  status?: string;
  animalType?: string;
  assignedRescuerName?: string;
  action?: "view_case" | string;
  createdAt: string;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (notification: Notification) => void;
  markAsRead: (notificationId: string) => void;
  markAllAsRead: () => void;
  removeNotification: (notificationId: string) => void;
  clearNotifications: () => void;
  fetchNotifications: () => Promise<void>;
  loading: boolean;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotification must be used within NotificationProvider");
  }
  return context;
};

interface NotificationProviderProps {
  children: React.ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const seenNotificationIdsRef = useRef<Set<string>>(new Set());
  const initialFetchDoneRef = useRef(false);

  // Fetch notifications from backend
  const fetchNotifications = React.useCallback(async () => {
    let timeoutId: any = null;
    try {
      const token = await SecureStore.getItemAsync("authToken");
      if (!token) {
        return;
      }

      setLoading(true);
      const url = `${API_URL}/stray/notifications`;
      const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
      if (controller) {
        timeoutId = setTimeout(() => controller.abort(), 10000);
      }

      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        ...(controller ? { signal: controller.signal as any } : {}),
      });

      if (timeoutId) clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn("[NOTIFICATION] Fetch responded with status:", response.status);
        return;
      }

      const data = (await response.json()) as any;
      const list: Notification[] = Array.isArray(data) ? data : [];
      setNotifications(list);

      // Trigger local OS banner notification for newly arrived unread notifications.
      // Since we removed the re-triggering logic in _layout.tsx, this is safe and will only happen once.
      if (initialFetchDoneRef.current) {
        list.forEach((notif) => {
          const id = String(notif._id || "");
          if (id && !notif.read && !seenNotificationIdsRef.current.has(id)) {
            void pushNotificationService.presentLocalNotification(notif.title, notif.message, {
              caseId: notif.caseId,
              rescueRequestId: notif.rescueRequestId,
              event: notif.event,
            });
            seenNotificationIdsRef.current.add(id);
          }
        });
      } else {
        initialFetchDoneRef.current = true;
      }

      // Mark all current IDs as seen in ref
      list.forEach((notif) => {
        const id = String(notif._id || "");
        if (id) seenNotificationIdsRef.current.add(id);
      });
    } catch (error: any) {
      if (timeoutId) clearTimeout(timeoutId);
      if (error?.name !== "AbortError") {
        console.warn("[NOTIFICATION] Fetch error:", error?.message || error);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Add local notification
  const addNotification = React.useCallback((notification: Notification) => {
    setNotifications((prev) => [notification, ...prev]);
  }, []);

  // Mark notification as read
  const markAsRead = async (notificationId: string) => {
    try {
      const token = await SecureStore.getItemAsync("authToken");
      if (!token) return;

      const response = await fetch(
        `${API_URL}/stray/notifications/${notificationId}/read`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n._id === notificationId ? { ...n, read: true } : n))
        );
      }
    } catch (error) {
      console.warn("[NOTIFICATION] Failed to mark notification as read:", error);
    }
  };

  // Remove notification locally
  const removeNotification = (notificationId: string) => {
    setNotifications((prev) => prev.filter((n) => n._id !== notificationId));
  };

  // Mark all notifications as read
  const markAllAsRead = async () => {
    try {
      const token = await SecureStore.getItemAsync("authToken");
      if (!token) return;

      const unreadIds = notifications.filter((n) => !n.read).map((n) => n._id);
      if (unreadIds.length === 0) return;

      // Optimistically update UI
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read: true }))
      );

      // Hit the backend for each unread (or ideally a bulk endpoint if it existed, but we'll do individual for now)
      await Promise.all(
        unreadIds.map((id) =>
          fetch(`${API_URL}/stray/notifications/${id}/read`, {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          })
        )
      );
    } catch (error) {
      console.warn("[NOTIFICATION] Failed to mark all as read:", error);
    }
  };

  // Clear all notifications
  const clearNotifications = () => {
    setNotifications([]);
  };

  // Calculate unread count
  const unreadCount = notifications.filter((n) => !n.read).length;

  // Auto-refresh notifications every 3 seconds for real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      fetchNotifications();
    }, 3000);

    return () => clearInterval(interval);
  }, [fetchNotifications]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        addNotification,
        markAsRead,
        markAllAsRead,
        removeNotification,
        clearNotifications,
        fetchNotifications,
        loading,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};
