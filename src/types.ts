export type ParcelStatus = "accepted" | "in_transit" | "delivered";

export interface Parcel {
  id: string;
  destination: string;
  weightKg: number;
  status: ParcelStatus;
  createdAt: string;
}

/** What a caller sends to POST /parcels. weightKg is validated at runtime. */
export interface NewParcel {
  destination: string;
  weightKg: unknown;
}
