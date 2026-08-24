import { find, nextId, save } from "./store";
import type { NewParcel, Parcel, ParcelStatus } from "./types";

const NEXT_STATUS: Record<ParcelStatus, ParcelStatus | null> = {
  accepted: "in_transit",
  in_transit: "delivered",
  delivered: null,
};

/**
 * Throw a descriptive Error when `input.weightKg` is missing, not a finite
 * number, or not greater than zero.
 */
export function validateWeight(input: { weightKg?: unknown }): void {
  if (input.weightKg === undefined || input.weightKg === null) {
    throw new Error("weightKg is required");
  }
  if (typeof input.weightKg !== "number" || !Number.isFinite(input.weightKg)) {
    throw new Error("weightKg must be a number");
  }
  if (input.weightKg <= 0) {
    throw new Error("weightKg must be greater than zero");
  }
}

/**
 * Book a new parcel into the network.
 *
 * Validates the incoming fields before persisting.
 */
export function createParcel(input: NewParcel): Parcel {
  validateWeight(input);
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
