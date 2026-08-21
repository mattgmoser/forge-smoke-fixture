import { find, nextId, save } from "./store";
import type { NewParcel, Parcel, ParcelStatus } from "./types";

const NEXT_STATUS: Record<ParcelStatus, ParcelStatus | null> = {
  accepted: "in_transit",
  in_transit: "delivered",
  delivered: null,
};

/**
 * Validate the raw body sent to POST /parcels.
 *
 * Throws a descriptive Error when weightKg is absent, not a finite number, or
 * not greater than zero.
 */
export function validateNewParcel(input: unknown): asserts input is NewParcel {
  if (
    typeof input !== "object" ||
    input === null ||
    !("weightKg" in input) ||
    typeof (input as Record<string, unknown>).weightKg !== "number" ||
    !isFinite((input as Record<string, unknown>).weightKg as number) ||
    ((input as Record<string, unknown>).weightKg as number) <= 0
  ) {
    throw new Error("weightKg is required and must be a number greater than zero");
  }
}

/**
 * Book a new parcel into the network.
 *
 * Callers must validate input with validateNewParcel before calling this.
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
