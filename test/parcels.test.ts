import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
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
      () => createParcel({ destination: "London" } as never),
      { message: "weightKg must be a number" },
    );
  });

  it("rejects a string weightKg", () => {
    assert.throws(
      () => createParcel({ destination: "London", weightKg: "heavy" } as never),
      { message: "weightKg must be a number" },
    );
  });

  it("rejects zero", () => {
    assert.throws(
      () => createParcel({ destination: "London", weightKg: 0 }),
      { message: "weightKg must be greater than zero" },
    );
  });

  it("rejects a negative weight", () => {
    assert.throws(
      () => createParcel({ destination: "London", weightKg: -1 }),
      { message: "weightKg must be greater than zero" },
    );
  });

  it("accepts a positive weight", () => {
    const parcel = createParcel({ destination: "London", weightKg: 0.1 });
    assert.equal(parcel.weightKg, 0.1);
  });
});

describe("POST /parcels weightKg validation over HTTP", () => {
  /** Start the server on an OS-assigned port; stop it after the test. */
  function withServer(fn: (baseUrl: string) => Promise<void>): () => Promise<void> {
    return async () => {
      await new Promise<void>((resolve) => server.listen(0, resolve));
      const addr = server.address() as import("node:net").AddressInfo;
      try {
        await fn(`http://127.0.0.1:${addr.port}`);
      } finally {
        await new Promise<void>((resolve, reject) =>
          server.close((err) => (err ? reject(err) : resolve())),
        );
      }
    };
  }

  function post(url: string, body: unknown): Promise<{ status: number; body: Record<string, unknown> }> {
    return new Promise((resolve, reject) => {
      const payload = JSON.stringify(body);
      const req = require("node:http").request(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) },
      }, (res: import("node:http").IncomingMessage) => {
        let data = "";
        res.on("data", (c: string) => (data += c));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body: JSON.parse(data) }));
      });
      req.on("error", reject);
      req.end(payload);
    });
  }

  it("returns 400 when weightKg is missing", withServer(async (base) => {
    const res = await post(`${base}/parcels`, { destination: "London" });
    assert.equal(res.status, 400);
    assert.equal(res.body.error, "weightKg must be a number");
  }));

  it("returns 400 when weightKg is a string", withServer(async (base) => {
    const res = await post(`${base}/parcels`, { destination: "London", weightKg: "heavy" });
    assert.equal(res.status, 400);
    assert.equal(res.body.error, "weightKg must be a number");
  }));

  it("returns 400 when weightKg is zero", withServer(async (base) => {
    const res = await post(`${base}/parcels`, { destination: "London", weightKg: 0 });
    assert.equal(res.status, 400);
    assert.equal(res.body.error, "weightKg must be greater than zero");
  }));

  it("returns 400 when weightKg is negative", withServer(async (base) => {
    const res = await post(`${base}/parcels`, { destination: "London", weightKg: -5 });
    assert.equal(res.status, 400);
    assert.equal(res.body.error, "weightKg must be greater than zero");
  }));

  it("returns 201 when weightKg is a positive number", withServer(async (base) => {
    const res = await post(`${base}/parcels`, { destination: "London", weightKg: 3 });
    assert.equal(res.status, 201);
    assert.equal((res.body.parcel as Record<string, unknown>).weightKg, 3);
  }));
});
