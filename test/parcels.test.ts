import assert from "node:assert/strict";
import { request } from "node:http";
import { after, before, beforeEach, describe, it } from "node:test";
import { advanceParcel, createParcel, getParcel, quote } from "../src/parcels";
import { server } from "../src/server";
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

describe("createParcel weightKg validation", () => {
  it("rejects a missing weightKg", () => {
    assert.throws(
      () => createParcel({ destination: "Bristol" } as never),
      RangeError,
    );
  });

  it("rejects a non-numeric weightKg", () => {
    assert.throws(
      () => createParcel({ destination: "Bristol", weightKg: "heavy" } as never),
      RangeError,
    );
  });

  it("rejects zero", () => {
    assert.throws(
      () => createParcel({ destination: "Bristol", weightKg: 0 }),
      RangeError,
    );
  });

  it("rejects a negative weightKg", () => {
    assert.throws(
      () => createParcel({ destination: "Bristol", weightKg: -1 }),
      RangeError,
    );
  });

  it("accepts a positive weightKg", () => {
    const parcel = createParcel({ destination: "Bristol", weightKg: 0.1 });
    assert.equal(parcel.weightKg, 0.1);
  });
});

describe("POST /parcels weightKg validation", () => {
  /** Bind on an OS-chosen port and clean up after the suite. */
  let port: number;
  before(() =>
    new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => {
        port = (server.address() as import("node:net").AddressInfo).port;
        resolve();
      });
    }),
  );
  after(() => new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve()))));

  function post(body: string): Promise<{ status: number; body: Record<string, unknown> }> {
    return new Promise((resolve, reject) => {
      const req = request(
        { hostname: "127.0.0.1", port, path: "/parcels", method: "POST",
          headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) } },
        (res) => {
          let raw = "";
          res.on("data", (chunk) => (raw += chunk));
          res.on("end", () => resolve({ status: res.statusCode ?? 0, body: JSON.parse(raw) }));
        },
      );
      req.on("error", reject);
      req.end(body);
    });
  }

  it("returns 400 when weightKg is missing", async () => {
    const res = await post(JSON.stringify({ destination: "York" }));
    assert.equal(res.status, 400);
    assert.ok(typeof res.body.error === "string");
  });

  it("returns 400 when weightKg is a string", async () => {
    const res = await post(JSON.stringify({ destination: "York", weightKg: "heavy" }));
    assert.equal(res.status, 400);
    assert.ok(typeof res.body.error === "string");
  });

  it("returns 400 when weightKg is zero", async () => {
    const res = await post(JSON.stringify({ destination: "York", weightKg: 0 }));
    assert.equal(res.status, 400);
    assert.ok(typeof res.body.error === "string");
  });

  it("returns 400 when weightKg is negative", async () => {
    const res = await post(JSON.stringify({ destination: "York", weightKg: -5 }));
    assert.equal(res.status, 400);
    assert.ok(typeof res.body.error === "string");
  });

  it("returns 201 for a valid parcel", async () => {
    const res = await post(JSON.stringify({ destination: "York", weightKg: 3 }));
    assert.equal(res.status, 201);
    assert.ok(res.body.parcel);
  });
});
