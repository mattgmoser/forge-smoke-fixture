import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { advanceParcel, createParcel, getParcel, quote, validateNewParcel } from "../src/parcels";
import { reset } from "../src/store";

beforeEach(() => reset());

describe("createParcel", () => {
  it("books a parcel and gives it a readable id", () => {
    const parcel = createParcel({ destination: "Manchester", weightKg: 2 });
    assert.equal(parcel.id, "PT-000001");
    assert.equal(parcel.destination, "Manchester");
    assert.equal(parcel.status, "accepted");
  });

  it("numbers parcels in the order they are booked", () => {
    createParcel({ destination: "Leeds", weightKg: 1 });
    const second = createParcel({ destination: "Bath", weightKg: 1 });
    assert.equal(second.id, "PT-000002");
  });
});

describe("getParcel", () => {
  it("finds a parcel that exists", () => {
    const created = createParcel({ destination: "Cardiff", weightKg: 3 });
    assert.deepEqual(getParcel(created.id), created);
  });

  it("returns nothing for an unknown id", () => {
    assert.equal(getParcel("PT-999999"), undefined);
  });
});

describe("advanceParcel", () => {
  it("moves accepted to in transit, then to delivered", () => {
    const created = createParcel({ destination: "Hull", weightKg: 1 });
    assert.equal(advanceParcel(created.id)?.status, "in_transit");
    assert.equal(advanceParcel(created.id)?.status, "delivered");
  });

  it("leaves a delivered parcel alone", () => {
    const created = createParcel({ destination: "Hull", weightKg: 1 });
    advanceParcel(created.id);
    advanceParcel(created.id);
    assert.equal(advanceParcel(created.id)?.status, "delivered");
  });
});

describe("quote", () => {
  it("charges handling plus a per-kilo rate", () => {
    const parcel = createParcel({ destination: "Derby", weightKg: 2.5 });
    assert.equal(quote(parcel), 250 + 300);
  });
});

describe("validateNewParcel", () => {
  it("returns null for a valid input", () => {
    assert.equal(validateNewParcel({ destination: "Bristol", weightKg: 1 }), null);
  });

  it("rejects input when weightKg is missing", () => {
    const error = validateNewParcel({ destination: "Bristol" });
    assert.ok(error, "expected an error string");
    assert.match(error as string, /weightKg/);
  });

  it("rejects input when weightKg is null", () => {
    const error = validateNewParcel({ destination: "Bristol", weightKg: null });
    assert.ok(error, "expected an error string");
    assert.match(error as string, /weightKg/);
  });

  it("rejects input when weightKg is a string", () => {
    const error = validateNewParcel({ destination: "Bristol", weightKg: "heavy" });
    assert.ok(error, "expected an error string");
    assert.match(error as string, /weightKg/);
  });

  it("rejects input when weightKg is zero", () => {
    const error = validateNewParcel({ destination: "Bristol", weightKg: 0 });
    assert.ok(error, "expected an error string");
    assert.match(error as string, /weightKg/);
  });

  it("rejects input when weightKg is negative", () => {
    const error = validateNewParcel({ destination: "Bristol", weightKg: -5 });
    assert.ok(error, "expected an error string");
    assert.match(error as string, /weightKg/);
  });

  it("rejects input when weightKg is NaN", () => {
    const error = validateNewParcel({ destination: "Bristol", weightKg: NaN });
    assert.ok(error, "expected an error string");
    assert.match(error as string, /weightKg/);
  });
});
