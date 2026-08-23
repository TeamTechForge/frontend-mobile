import { StyleSheet } from "react-native";
import { colors } from "../constants/colors.constants";
import { spacing } from "../constants/spacing.constants";
import { typography } from "../constants/typography.constants";

export const threadStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  page: { flex: 1, paddingHorizontal: spacing.xl, paddingTop: spacing.xl },

  pageTitle: {
    fontSize: typography.title,
    fontFamily: typography.bold,
    color: colors.text,
    marginBottom: spacing.md,
  },

  headerCard: {
    backgroundColor: "#F6E9D4",
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  headerTitle: {
    fontFamily: typography.semibold,
    color: colors.text,
    fontSize: 13,
    marginBottom: 10,
  },
  headerActions: { flexDirection: "row", gap: 14 },
  headerLike: { fontFamily: typography.bold, color: "#444" },

  list: { flex: 1 },

  msgCard: {
    backgroundColor: "#FAFAFA",
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: "#EEE",
  },

  msgTopRow: { flexDirection: "row", justifyContent: "space-between" },
  msgLeft: { flexDirection: "row", gap: 10 },

  avatarCircle: {
    width: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: "#E9F1FF",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontFamily: typography.bold, color: "#2563EB" },

  nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  nameText: { fontFamily: typography.bold, color: colors.text },

  roleBadge: { paddingVertical: 2, paddingHorizontal: 8, borderRadius: 999 },
  badgeVet: { backgroundColor: "#FFE7E7" },
  badgeNGO: { backgroundColor: "#E7FFEF" },
  roleText: { fontFamily: typography.bold, fontSize: 11, color: "#333" },

  subText: { fontFamily: typography.medium, fontSize: 11, color: "#777" },
  timeText: { fontFamily: typography.medium, fontSize: 11, color: "#999" },

  msgBody: { marginTop: 10, fontFamily: typography.medium, color: "#555", lineHeight: 18 },

  msgActionsRow: { marginTop: 10, flexDirection: "row" },
  msgLikeBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0F0F0",
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  msgLikeBtnActive: { backgroundColor: "#FFE7A8" },
  msgLikeText: { fontFamily: typography.semibold, color: colors.text },

  composerRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  composerInput: {
    flex: 1,
    backgroundColor: "#F7F7F7",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: typography.medium,
    color: colors.text,
  },
  composerBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 14,
    justifyContent: "center",
  },
  composerBtnText: { fontFamily: typography.bold, color: colors.text },
});
