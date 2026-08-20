import assert from "node:assert/strict";
import { request } from "node:http";
import { afterEach, beforeEach, describe, it } from "node:test";
import { advanceParcel, createParcel, getParcel, quote, ValidationError } from "../src/parcels";
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
  it("throws ValidationError when weightKg is missing", () => {
    assert.throws(
      () => createParcel({ destination: "Bristol" } as never),
      (err: unknown) => err instanceof ValidationError,
    );
  });

  it("throws ValidationError when weightKg is not a number", () => {
    assert.throws(
      () => createParcel({ destination: "Bristol", weightKg: "heavy" } as never),
      (err: unknown) => err instanceof ValidationError,
    );
  });

  it("throws ValidationError when weightKg is zero", () => {
    assert.throws(
      () => createParcel({ destination: "Bristol", weightKg: 0 }),
      (err: unknown) => err instanceof ValidationError,
    );
  });

  it("throws ValidationError when weightKg is negative", () => {
    assert.throws(
      () => createParcel({ destination: "Bristol", weightKg: -1 }),
      (err: unknown) => err instanceof ValidationError,
    );
  });

  it("accepts a positive weightKg", () => {
    const parcel = createParcel({ destination: "Bristol", weightKg: 0.1 });
    assert.equal(parcel.weightKg, 0.1);
  });
});

describe("POST /parcels weightKg validation", () => {
  let port: number;

  beforeEach(() => new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      port = (server.address() as import("node:net").AddressInfo).port;
      resolve();
    });
  }));

  afterEach(() => new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  }));

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
    const { status, body } = await post(JSON.stringify({ destination: "York" }));
    assert.equal(status, 400);
    assert.ok(typeof (body as { error: string }).error === "string");
  });

  it("returns 400 when weightKg is not a number", async () => {
    const { status, body } = await post(JSON.stringify({ destination: "York", weightKg: "heavy" }));
    assert.equal(status, 400);
    assert.ok(typeof (body as { error: string }).error === "string");
  });

  it("returns 400 when weightKg is zero", async () => {
    const { status, body } = await post(JSON.stringify({ destination: "York", weightKg: 0 }));
    assert.equal(status, 400);
    assert.ok(typeof (body as { error: string }).error === "string");
  });

  it("returns 400 when weightKg is negative", async () => {
    const { status, body } = await post(JSON.stringify({ destination: "York", weightKg: -5 }));
    assert.equal(status, 400);
    assert.ok(typeof (body as { error: string }).error === "string");
  });

  it("returns 201 when weightKg is valid", async () => {
    const { status } = await post(JSON.stringify({ destination: "York", weightKg: 3 }));
    assert.equal(status, 201);
  });
});
