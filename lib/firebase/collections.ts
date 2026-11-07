export const Collections = {
  USERS: "users",
  CLASSROOMS: "classrooms",
  BOOKINGS: "bookings",
  SETTINGS: "settings",
  INVITATIONS: "invitations",
  BOOKING_SERIES: "bookingSeries",
} as const;

export type CollectionName = (typeof Collections)[keyof typeof Collections];
