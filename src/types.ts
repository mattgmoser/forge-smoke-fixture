// Defines the shared TypeScript types and interfaces used across the application.
export type ParcelStatus = "accepted" | "in_transit" | "delivered";

export interface Parcel {
  id: string;
  destination: string;
  weightKg: number;
  status: ParcelStatus;
  createdAt: string;
}

/** What a caller sends to POST /parcels. */
export interface NewParcel {
  destination: string;
  weightKg: number;
}
