import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { advanceParcel, createParcel, getParcel, quote } from "../src/parcels";
import { reset } from "../src/store";
import { server } from "../src/server";
import { AddressInfo } from "node:net";

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

describe("createParcel weightKg validation", () => {
  it("rejects a missing weightKg", () => {
    assert.throws(
      () => createParcel({ destination: "Bristol" } as any),
      RangeError,
    );
  });

  it("rejects a non-number weightKg", () => {
    assert.throws(
      () => createParcel({ destination: "Bristol", weightKg: "heavy" } as any),
      RangeError,
    );
  });

  it("rejects zero", () => {
    assert.throws(
      () => createParcel({ destination: "Bristol", weightKg: 0 }),
      RangeError,
    );
  });

  it("rejects a negative weight", () => {
    assert.throws(
      () => createParcel({ destination: "Bristol", weightKg: -1 }),
      RangeError,
    );
  });

  it("accepts a positive weight", () => {
    const parcel = createParcel({ destination: "Bristol", weightKg: 0.1 });
    assert.equal(parcel.weightKg, 0.1);
  });
});

describe("POST /parcels weightKg validation", () => {
  async function post(body: unknown): Promise<{ status: number; body: any }> {
    const { port } = server.address() as AddressInfo;
    const res = await fetch(`http://localhost:${port}/parcels`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return { status: res.status, body: await res.json() };
  }

  it("returns 400 when weightKg is missing", async () => {
    server.listen(0);
    try {
      const { status, body } = await post({ destination: "Norwich" });
      assert.equal(status, 400);
      assert.ok(body.error);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("returns 400 when weightKg is not a number", async () => {
    server.listen(0);
    try {
      const { status, body } = await post({ destination: "Norwich", weightKg: "heavy" });
      assert.equal(status, 400);
      assert.ok(body.error);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("returns 400 when weightKg is zero", async () => {
    server.listen(0);
    try {
      const { status, body } = await post({ destination: "Norwich", weightKg: 0 });
      assert.equal(status, 400);
      assert.ok(body.error);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("returns 400 when weightKg is negative", async () => {
    server.listen(0);
    try {
      const { status, body } = await post({ destination: "Norwich", weightKg: -5 });
      assert.equal(status, 400);
      assert.ok(body.error);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("returns 201 for a valid parcel", async () => {
    server.listen(0);
    try {
      const { status, body } = await post({ destination: "Norwich", weightKg: 3 });
      assert.equal(status, 201);
      assert.ok(body.parcel.id);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
