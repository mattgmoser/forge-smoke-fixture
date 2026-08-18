import assert from "node:assert/strict";
import http from "node:http";
import { beforeEach, describe, it } from "node:test";
import { advanceParcel, createParcel, getParcel, quote } from "../src/parcels";
import { reset } from "../src/store";
import { server } from "../src/server";

/** POST /parcels against a temporary listener; returns status and parsed body. */
function postParcel(body: unknown): Promise<{ status: number; body: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const testServer = http.createServer(
      server.listeners("request")[0] as Parameters<typeof http.createServer>[0]
    );
    testServer.listen(0, "127.0.0.1", () => {
      const { port } = testServer.address() as { port: number };
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port,
          path: "/parcels",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(payload),
          },
        },
        (res) => {
          let data = "";
          res.on("data", (chunk: Buffer) => (data += chunk));
          res.on("end", () => {
            testServer.close();
            resolve({ status: res.statusCode ?? 0, body: JSON.parse(data) });
          });
        }
      );
      req.on("error", (err: Error) => { testServer.close(); reject(err); });
      req.write(payload);
      req.end();
    });
  });
}

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

  it("rejects a missing weightKg", () => {
    assert.throws(
      () => createParcel({ destination: "Bristol" } as never),
      RangeError
    );
  });

  it("rejects a non-number weightKg", () => {
    assert.throws(
      () => createParcel({ destination: "Bristol", weightKg: "heavy" as never }),
      RangeError
    );
  });

  it("rejects zero weightKg", () => {
    assert.throws(
      () => createParcel({ destination: "Bristol", weightKg: 0 }),
      RangeError
    );
  });

  it("rejects a negative weightKg", () => {
    assert.throws(
      () => createParcel({ destination: "Bristol", weightKg: -1 }),
      RangeError
    );
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

describe("POST /parcels", () => {
  it("returns 201 and the parcel for a valid request", async () => {
    const result = await postParcel({ destination: "Brighton", weightKg: 3 });
    assert.equal(result.status, 201);
    assert.equal((result.body.parcel as { destination: string }).destination, "Brighton");
  });

  it("returns 400 when weightKg is missing", async () => {
    const result = await postParcel({ destination: "Brighton" });
    assert.equal(result.status, 400);
    assert.ok(typeof result.body.error === "string");
  });

  it("returns 400 when weightKg is a string", async () => {
    const result = await postParcel({ destination: "Brighton", weightKg: "heavy" });
    assert.equal(result.status, 400);
    assert.ok(typeof result.body.error === "string");
  });

  it("returns 400 when weightKg is zero", async () => {
    const result = await postParcel({ destination: "Brighton", weightKg: 0 });
    assert.equal(result.status, 400);
    assert.ok(typeof result.body.error === "string");
  });

  it("returns 400 when weightKg is negative", async () => {
    const result = await postParcel({ destination: "Brighton", weightKg: -5 });
    assert.equal(result.status, 400);
    assert.ok(typeof result.body.error === "string");
  });
});
