import { find, nextId, save } from "./store";
import type { NewParcel, Parcel, ParcelStatus } from "./types";

const NEXT_STATUS: Record<ParcelStatus, ParcelStatus | null> = {
  accepted: "in_transit",
  in_transit: "delivered",
  delivered: null,
};

export class ParcelValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ParcelValidationError";
  }
}

/**
 * Validate the fields supplied for a new parcel.
 * Throws {@link ParcelValidationError} on the first problem found.
 */
function validateNewParcel(input: unknown): asserts input is NewParcel {
  if (typeof input !== "object" || input === null) {
    throw new ParcelValidationError("Request body must be a JSON object");
  }
  const { weightKg } = input as Record<string, unknown>;
  if (weightKg === undefined || weightKg === null) {
    throw new ParcelValidationError("weightKg is required");
  }
  if (typeof weightKg !== "number" || !isFinite(weightKg)) {
    throw new ParcelValidationError("weightKg must be a number");
  }
  if (weightKg <= 0) {
    throw new ParcelValidationError("weightKg must be greater than zero");
  }
}

/**
 * Book a new parcel into the network.
 *
 * Throws {@link ParcelValidationError} when the input is invalid.
 */
export function createParcel(input: unknown): Parcel {
  validateNewParcel(input);
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
