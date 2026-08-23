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
  it("returns null for a valid parcel", () => {
    assert.equal(validateNewParcel({ destination: "Bristol", weightKg: 1 }), null);
  });

  it("rejects when weightKg is missing", () => {
    assert.match(
      validateNewParcel({ destination: "Bristol" }) ?? "",
      /weightKg/,
    );
  });

  it("rejects when weightKg is not a number", () => {
    assert.match(
      validateNewParcel({ destination: "Bristol", weightKg: "heavy" }) ?? "",
      /weightKg/,
    );
  });

  it("rejects when weightKg is zero", () => {
    assert.match(
      validateNewParcel({ destination: "Bristol", weightKg: 0 }) ?? "",
      /weightKg/,
    );
  });

  it("rejects when weightKg is negative", () => {
    assert.match(
      validateNewParcel({ destination: "Bristol", weightKg: -1 }) ?? "",
      /weightKg/,
    );
  });
});

describe("POST /parcels weight validation", () => {
  /** Fire a POST /parcels and resolve with the parsed JSON + status code. */
  async function post(body: unknown): Promise<{ status: number; body: Record<string, unknown> }> {
    const payload = JSON.stringify(body);
    return new Promise((resolve, reject) => {
      server.listen(0, "127.0.0.1", () => {
        const addr = server.address() as import("net").AddressInfo;
        import("node:http").then(({ request }) => {
          const options = {
            hostname: "127.0.0.1",
            port: addr.port,
            path: "/parcels",
            method: "POST",
            headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) },
          };
          const r = request(options, (res) => {
            let data = "";
            res.on("data", (chunk) => (data += chunk));
            res.on("end", () => {
              server.close(() => resolve({ status: res.statusCode ?? 0, body: JSON.parse(data) }));
            });
          });
          r.on("error", (err) => { server.close(() => reject(err)); });
          r.write(payload);
          r.end();
        });
      });
    });
  }

  it("accepts a valid parcel and returns 201", async () => {
    const result = await post({ destination: "Norwich", weightKg: 3 });
    assert.equal(result.status, 201);
  });

  it("returns 400 when weightKg is missing", async () => {
    const result = await post({ destination: "Norwich" });
    assert.equal(result.status, 400);
    assert.ok(typeof result.body.error === "string");
  });

  it("returns 400 when weightKg is not a number", async () => {
    const result = await post({ destination: "Norwich", weightKg: "lots" });
    assert.equal(result.status, 400);
    assert.ok(typeof result.body.error === "string");
  });

  it("returns 400 when weightKg is zero", async () => {
    const result = await post({ destination: "Norwich", weightKg: 0 });
    assert.equal(result.status, 400);
    assert.ok(typeof result.body.error === "string");
  });

  it("returns 400 when weightKg is negative", async () => {
    const result = await post({ destination: "Norwich", weightKg: -5 });
    assert.equal(result.status, 400);
    assert.ok(typeof result.body.error === "string");
  });
});
