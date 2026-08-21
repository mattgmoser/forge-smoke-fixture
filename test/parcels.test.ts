import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { advanceParcel, createParcel, getParcel, quote, ValidationError } from "../src/parcels";
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

describe("createParcel weightKg validation", () => {
  it("throws ValidationError when weightKg is missing", () => {
    assert.throws(
      () => createParcel({ destination: "Bristol" } as never),
      (err: unknown) => err instanceof ValidationError,
    );
  });

  it("throws ValidationError when weightKg is a string", () => {
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

describe("POST /parcels weightKg validation over HTTP", () => {
  function post(body: string): Promise<{ status: number; body: Record<string, unknown> }> {
    return new Promise((resolve, reject) => {
      server.listen(0, "127.0.0.1", () => {
        const addr = server.address() as import("net").AddressInfo;
        const options = {
          hostname: "127.0.0.1",
          port: addr.port,
          path: "/parcels",
          method: "POST",
          headers: { "Content-Type": "application/json" },
        };
        const req = require("node:http").request(options, (res: import("node:http").IncomingMessage) => {
          let raw = "";
          res.on("data", (chunk: Buffer) => (raw += chunk));
          res.on("end", () => {
            server.close();
            resolve({ status: res.statusCode ?? 0, body: JSON.parse(raw) });
          });
        });
        req.on("error", (err: Error) => { server.close(); reject(err); });
        req.end(body);
      });
    });
  }

  it("returns 422 when weightKg is missing", async () => {
    const res = await post(JSON.stringify({ destination: "Exeter" }));
    assert.equal(res.status, 422);
    assert.ok(typeof (res.body as { error: string }).error === "string");
  });

  it("returns 422 when weightKg is not a number", async () => {
    const res = await post(JSON.stringify({ destination: "Exeter", weightKg: "heavy" }));
    assert.equal(res.status, 422);
  });

  it("returns 422 when weightKg is zero", async () => {
    const res = await post(JSON.stringify({ destination: "Exeter", weightKg: 0 }));
    assert.equal(res.status, 422);
  });

  it("returns 422 when weightKg is negative", async () => {
    const res = await post(JSON.stringify({ destination: "Exeter", weightKg: -5 }));
    assert.equal(res.status, 422);
  });

  it("returns 201 for a valid parcel", async () => {
    const res = await post(JSON.stringify({ destination: "Exeter", weightKg: 3 }));
    assert.equal(res.status, 201);
  });
});
