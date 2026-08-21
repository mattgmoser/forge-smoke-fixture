import assert from "node:assert/strict";
import { request } from "node:http";
import { afterEach, beforeEach, describe, it } from "node:test";
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

// ---------------------------------------------------------------------------
// HTTP – POST /parcels weightKg validation
// ---------------------------------------------------------------------------

describe("POST /parcels weightKg validation", () => {
  let port: number;

  beforeEach((_, done) => {
    server.listen(0, "127.0.0.1", () => {
      port = (server.address() as import("node:net").AddressInfo).port;
      done();
    });
  });

  afterEach((_, done) => {
    server.close(() => done());
  });

  function post(body: unknown): Promise<{ status: number; body: Record<string, unknown> }> {
    return new Promise((resolve, reject) => {
      const payload = JSON.stringify(body);
      const req = request(
        { hostname: "127.0.0.1", port, method: "POST", path: "/parcels",
          headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } },
        (res) => {
          let raw = "";
          res.on("data", (c) => (raw += c));
          res.on("end", () => resolve({ status: res.statusCode ?? 0, body: JSON.parse(raw) }));
        },
      );
      req.on("error", reject);
      req.write(payload);
      req.end();
    });
  }

  it("accepts a valid parcel and returns 201", async () => {
    const { status, body } = await post({ destination: "Bristol", weightKg: 1.5 });
    assert.equal(status, 201);
    assert.equal((body.parcel as { destination: string }).destination, "Bristol");
  });

  it("rejects a missing weightKg with 400", async () => {
    const { status, body } = await post({ destination: "Bristol" });
    assert.equal(status, 400);
    assert.match(body.error as string, /weightKg/);
  });

  it("rejects a string weightKg with 400", async () => {
    const { status, body } = await post({ destination: "Bristol", weightKg: "heavy" });
    assert.equal(status, 400);
    assert.match(body.error as string, /weightKg/);
  });

  it("rejects weightKg of zero with 400", async () => {
    const { status, body } = await post({ destination: "Bristol", weightKg: 0 });
    assert.equal(status, 400);
    assert.match(body.error as string, /weightKg/);
  });

  it("rejects a negative weightKg with 400", async () => {
    const { status, body } = await post({ destination: "Bristol", weightKg: -5 });
    assert.equal(status, 400);
    assert.match(body.error as string, /weightKg/);
  });
});
