export const Collections = {
  USERS: "users",
  CLASSROOMS: "classrooms",
  BOOKINGS: "bookings",
  SETTINGS: "settings",
} as const;

export type CollectionName = (typeof Collections)[keyof typeof Collections];
