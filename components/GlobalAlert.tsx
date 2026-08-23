import React, { createContext, useContext, useEffect, useState } from "react";
import { Modal, StyleSheet, Text, View, TouchableOpacity, Alert, BackHandler } from "react-native";
import { Ionicons } from "@expo/vector-icons";

// Static reference to trigger the modal from standard function calls
interface GlobalAlertRef {
  show: (title: string, message?: string, buttons?: any[]) => void;
}

export const globalAlertRef: GlobalAlertRef = {
  show: () => {
    console.warn("GlobalAlertProvider is not mounted yet.");
  },
};

export const showGlobalAlert = (title: string, message?: string, buttons?: any[]) => {
  globalAlertRef.show(title, message, buttons);
};

// Override standard Alert.alert and global alert
const originalAlert = Alert.alert;
Alert.alert = (title: string, message?: string, buttons?: any[]) => {
  showGlobalAlert(title || "Alert", message, buttons);
  return {
    // Return empty handle to match React Native alert interfaces
  } as any;
};

(global as any).alert = (message: any) => {
  showGlobalAlert("Alert", String(message));
};

interface AlertProviderProps {
  children: React.ReactNode;
}

export function AlertProvider({ children }: AlertProviderProps) {
  const [visible, setVisible] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [buttons, setButtons] = useState<any[]>([]);

  useEffect(() => {
    globalAlertRef.show = (newTitle, newMessage = "", newButtons = []) => {
      setTitle(newTitle);
      setMessage(newMessage);
      setButtons(newButtons);
      setVisible(true);
    };
  }, []);

  const handleClose = () => {
    setVisible(false);
  };

  // Dynamically map generic "Alert" title to a more descriptive, context-aware title
  const getContextualTitle = () => {
    if (title !== "Alert") return title;

    const msg = message.toLowerCase();
    if (
      msg.includes("gallery") ||
      msg.includes("media") ||
      msg.includes("photo") ||
      msg.includes("image") ||
      msg.includes("camera")
    ) {
      return "Edit Profile";
    }
    if (msg.includes("location") || msg.includes("gps") || msg.includes("permission denied for location")) {
      return "Location Access Required";
    }
    if (msg.includes("profile")) {
      return "Edit Profile";
    }
    if (msg.includes("network") || msg.includes("connection") || msg.includes("server")) {
      return "Connection Error";
    }
    return "Notification";
  };

  const displayTitle = getContextualTitle();

  // Determine theme style (Success, Error, Warning, Info) based on keywords in title & message
  const getTheme = () => {
    const combined = (displayTitle + " " + message).toLowerCase();
    const isFailure =
      combined.includes("error") ||
      combined.includes("fail") ||
      combined.includes("could not") ||
      combined.includes("unable") ||
      combined.includes("denied") ||
      combined.includes("timeout") ||
      combined.includes("invalid") ||
      combined.includes("cannot") ||
      combined.includes("limit");

    // Check failure phrases before success phrases. For example,
    // "could not be uploaded" contains "uploaded" but must remain an error.
    if (isFailure) {
      return {
        icon: "close-circle-outline" as const,
        color: "#EF4444", // Red
        backgroundColor: "#FEF2F2",
      };
    }

    if (
      combined.includes("success") ||
      combined.includes("complete") ||
      combined.includes("published") ||
      combined.includes("uploaded") ||
      combined.includes("saved") ||
      combined.includes("approved") ||
      combined.includes("verified")
    ) {
      return {
        icon: "checkmark-circle-outline" as const,
        color: "#10B981", // Green
        backgroundColor: "#ECFDF5",
      };
    }
    if (
      combined.includes("warning") ||
      combined.includes("delete") ||
      combined.includes("remove") ||
      combined.includes("sure") ||
      combined.includes("attention") ||
      combined.includes("permission") ||
      combined.includes("access")
    ) {
      return {
        icon: "warning-outline" as const,
        color: "#F5A623", // Orange/Yellow
        backgroundColor: "#FFF9E6",
      };
    }
    return {
      icon: "information-circle-outline" as const,
      color: "#3B82F6", // Blue
      backgroundColor: "#EFF6FF",
    };
  };

  const theme = getTheme();

  return (
    <View style={{ flex: 1 }}>
      {children}
      
      <Modal
        transparent
        visible={visible}
        animationType="fade"
        onRequestClose={handleClose}
      >
        <View style={styles.overlay}>
          <View style={styles.modalContainer}>
            {/* Visual Icon Header */}
            <View style={[styles.iconContainer, { backgroundColor: theme.backgroundColor }]}>
              <Ionicons name={theme.icon} size={36} color={theme.color} />
            </View>

            <Text style={styles.title}>{displayTitle}</Text>
            {message ? <Text style={styles.message}>{message}</Text> : null}

            <View style={[styles.buttonContainer, buttons.length > 2 && { flexDirection: "column" }]}>
              {buttons.length === 0 ? (
                <TouchableOpacity style={styles.okButton} onPress={handleClose}>
                  <Text style={styles.okButtonText}>OK</Text>
                </TouchableOpacity>
              ) : (
                buttons.map((btn, index) => {
                  const isCancel = btn.style === "cancel";
                  const isDestructive = btn.style === "destructive";

                  let btnStyle = styles.confirmButton;
                  let textStyle = styles.confirmButtonText;

                  if (isCancel) {
                    btnStyle = styles.cancelButton;
                    textStyle = styles.cancelButtonText;
                  } else if (isDestructive) {
                    btnStyle = styles.destructiveButton;
                    textStyle = styles.destructiveButtonText;
                  }

                  return (
                    <TouchableOpacity
                      key={index}
                      style={[
                        btnStyle,
                        buttons.length > 2 && { width: "100%", marginVertical: 4 }
                      ]}
                      onPress={() => {
                        handleClose();
                        if (btn.onPress) {
                          btn.onPress();
                        }
                      }}
                    >
                      <Text style={textStyle}>{btn.text}</Text>
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalContainer: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    width: "85%",
    maxWidth: 340,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    fontFamily: "Inter-Bold",
    color: "#1F2937",
    marginBottom: 8,
    textAlign: "center",
  },
  message: {
    fontSize: 14,
    fontFamily: "Inter-Regular",
    color: "#4B5563",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  buttonContainer: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
    justifyContent: "center",
  },
  okButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#F5A623",
    alignItems: "center",
    justifyContent: "center",
  },
  okButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontFamily: "Inter-SemiBold",
    fontSize: 14,
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#F5A623",
    alignItems: "center",
    justifyContent: "center",
  },
  confirmButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontFamily: "Inter-SemiBold",
    fontSize: 14,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButtonText: {
    color: "#6B7280",
    fontWeight: "600",
    fontFamily: "Inter-SemiBold",
    fontSize: 14,
  },
  destructiveButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
  },
  destructiveButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontFamily: "Inter-SemiBold",
    fontSize: 14,
  },
});
