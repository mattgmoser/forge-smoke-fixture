import { find, nextId, save } from "./store";
import type { NewParcel, Parcel, ParcelStatus } from "./types";

const NEXT_STATUS: Record<ParcelStatus, ParcelStatus | null> = {
  accepted: "in_transit",
  in_transit: "delivered",
  delivered: null,
};

/**
 * Validate the fields supplied to POST /parcels.
 * Returns an error message string when invalid, or null when the input is fine.
 */
export function validateNewParcel(input: Record<string, unknown>): string | null {
  if (input.weightKg === undefined || input.weightKg === null) {
    return "weightKg is required";
  }
  if (typeof input.weightKg !== "number" || Number.isNaN(input.weightKg)) {
    return "weightKg must be a number";
  }
  if (input.weightKg <= 0) {
    return "weightKg must be greater than zero";
  }
  return null;
}

/**
 * Book a new parcel into the network.
 *
 * The carrier feed is trusted to send well-formed records, so the fields are
 * taken as given.
 */
export function createParcel(input: NewParcel): Parcel {
  return save({
    id: nextId(),
    destination: input.destination,
    weightKg: input.weightKg,
    status: "accepted",
    createdAt: new Date().toISOString(),
  });
}

export function getParcel(id: string): Parcel | undefined {
  return find(id);
}

/** Move a parcel to the next status. Delivered parcels do not move again. */
export function advanceParcel(id: string): Parcel | undefined {
  const parcel = find(id);
  if (!parcel) return undefined;

  const next = NEXT_STATUS[parcel.status];
  if (!next) return parcel;

  return save({ ...parcel, status: next });
}

/** Shipping cost in pence: a flat handling fee plus a per-kilo rate. */
export function quote(parcel: Parcel): number {
  const HANDLING_PENCE = 250;
  const PER_KG_PENCE = 120;
  return HANDLING_PENCE + Math.round(parcel.weightKg * PER_KG_PENCE);
}
