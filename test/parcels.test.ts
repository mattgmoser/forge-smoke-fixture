import assert from "node:assert/strict";
import http, { IncomingMessage } from "node:http";
import { after, before, beforeEach, describe, it } from "node:test";
import { advanceParcel, createParcel, getParcel, quote } from "../src/parcels";
import { server } from "../src/server";
import { reset } from "../src/store";

beforeEach(() => reset());

// ---------------------------------------------------------------------------
// Unit tests
// ---------------------------------------------------------------------------

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

  describe("weightKg validation", () => {
    it("rejects a missing weightKg", () => {
      assert.throws(
        () => createParcel({ destination: "Bristol" } as never),
        RangeError,
      );
    });

    it("rejects weightKg that is a string", () => {
      assert.throws(
        () => createParcel({ destination: "Bristol", weightKg: "heavy" as never }),
        RangeError,
      );
    });

    it("rejects weightKg of zero", () => {
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
// HTTP integration tests for POST /parcels weightKg validation
// ---------------------------------------------------------------------------

function postParcel(body: unknown): Promise<{ status: number; body: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const addr = server.address();
    const port = addr && typeof addr === "object" ? addr.port : 3000;
    const req = http.request(
      { method: "POST", path: "/parcels", host: "127.0.0.1", port, headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } },
      (res: IncomingMessage) => {
        let data = "";
        res.on("data", (chunk: Buffer) => (data += chunk));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body: JSON.parse(data) }));
      },
    );
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

describe("POST /parcels weightKg validation", () => {
  after(() => server.close());

  before(
    () =>
      new Promise<void>((resolve) => {
        if (server.listening) return resolve();
        server.listen(0, "127.0.0.1", resolve);
      }),
  );

  it("returns 400 when weightKg is missing", async () => {
    const res = await postParcel({ destination: "York" });
    assert.equal(res.status, 400);
    assert.equal(typeof res.body.error, "string");
  });

  it("returns 400 when weightKg is a string", async () => {
    const res = await postParcel({ destination: "York", weightKg: "heavy" });
    assert.equal(res.status, 400);
  });

  it("returns 400 when weightKg is zero", async () => {
    const res = await postParcel({ destination: "York", weightKg: 0 });
    assert.equal(res.status, 400);
  });

  it("returns 400 when weightKg is negative", async () => {
    const res = await postParcel({ destination: "York", weightKg: -5 });
    assert.equal(res.status, 400);
  });

  it("returns 201 when weightKg is a positive number", async () => {
    const res = await postParcel({ destination: "York", weightKg: 3 });
    assert.equal(res.status, 201);
  });
});
