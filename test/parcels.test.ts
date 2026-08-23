import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { advanceParcel, createParcel, getParcel, quote, validateNewParcel } from "../src/parcels";
import { reset } from "../src/store";
import { server } from "../src/server";

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
  it("accepts a positive weightKg", () => {
    assert.equal(validateNewParcel({ destination: "York", weightKg: 1 }), undefined);
  });

  it("rejects when weightKg is missing", () => {
    assert.match(validateNewParcel({ destination: "York" }) ?? "", /required/);
  });

  it("rejects when weightKg is not a number", () => {
    assert.match(validateNewParcel({ destination: "York", weightKg: "heavy" }) ?? "", /number/);
  });

  it("rejects when weightKg is zero", () => {
    assert.match(validateNewParcel({ destination: "York", weightKg: 0 }) ?? "", /greater than zero/);
  });

  it("rejects when weightKg is negative", () => {
    assert.match(validateNewParcel({ destination: "York", weightKg: -5 }) ?? "", /greater than zero/);
  });
});

describe("POST /parcels", () => {
  // Start the server on an OS-assigned port; close it after the describe block.
  let address: string;
  const serverSetup = new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address() as import("node:net").AddressInfo;
      address = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });

  // Helper that waits for the server to be ready before every fetch.
  async function post(body: unknown): Promise<Response> {
    await serverSetup;
    return fetch(`${address}/parcels`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("returns 201 for a valid parcel", async () => {
    const res = await post({ destination: "Bristol", weightKg: 3 });
    assert.equal(res.status, 201);
  });

  it("returns 422 when weightKg is missing", async () => {
    const res = await post({ destination: "Bristol" });
    assert.equal(res.status, 422);
    const body = await res.json() as { error: string };
    assert.match(body.error, /required/);
  });

  it("returns 422 when weightKg is not a number", async () => {
    const res = await post({ destination: "Bristol", weightKg: "lots" });
    assert.equal(res.status, 422);
    const body = await res.json() as { error: string };
    assert.match(body.error, /number/);
  });

  it("returns 422 when weightKg is zero", async () => {
    const res = await post({ destination: "Bristol", weightKg: 0 });
    assert.equal(res.status, 422);
    const body = await res.json() as { error: string };
    assert.match(body.error, /greater than zero/);
  });

  it("returns 422 when weightKg is negative", async () => {
    const res = await post({ destination: "Bristol", weightKg: -1 });
    assert.equal(res.status, 422);
    const body = await res.json() as { error: string };
    assert.match(body.error, /greater than zero/);
  });

  // Ensure the server is closed so the test process can exit.
  it("closes the server after all POST tests", async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve()))
    );
  });
});
