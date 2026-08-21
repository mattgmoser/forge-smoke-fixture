import { find, nextId, save } from "./store";
import type { NewParcel, Parcel, ParcelStatus } from "./types";

const NEXT_STATUS: Record<ParcelStatus, ParcelStatus | null> = {
  accepted: "in_transit",
  in_transit: "delivered",
  delivered: null,
};

/**
 * Validate the fields supplied for a new parcel.
 * Returns an error message string when the input is invalid, or null when valid.
 */
export function validateNewParcel(input: unknown): string | null {
  if (typeof input !== "object" || input === null) {
    return "Request body must be a JSON object";
  }
  const { weightKg } = input as Record<string, unknown>;
  if (weightKg === undefined || weightKg === null) {
    return "weightKg is required";
  }
  if (typeof weightKg !== "number" || !isFinite(weightKg)) {
    return "weightKg must be a number";
  }
  if (weightKg <= 0) {
    return "weightKg must be greater than zero";
  }
  return null;
}

/**
 * Book a new parcel into the network.
 *
 * Caller must validate input with validateNewParcel before calling this.
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
