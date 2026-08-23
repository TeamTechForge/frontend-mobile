export const COMMUNITY_POST_CATEGORIES = [
  "Pet Care Tips",
  "Health & First Aid",
  "Stray Animal Help",
  "Training & Behavior",
  "Animal Welfare & Rights Awareness",
  "Success Stories",
  "Events & Campaigns",
] as const;

export type CommunityPostCategory =
  (typeof COMMUNITY_POST_CATEGORIES)[number];
