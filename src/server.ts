import { createServer } from "node:http";
import { advanceParcel, createParcel, getParcel, quote } from "./parcels";
import { all } from "./store";

const PORT = Number(process.env.PORT) || 3000;

function json(res: import("node:http").ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(payload);
}

export const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  const parts = url.pathname.split("/").filter(Boolean);

  if (req.method === "GET" && parts[0] === "parcels" && parts.length === 1) {
    return json(res, 200, { parcels: all() });
  }

  if (req.method === "POST" && parts[0] === "parcels" && parts.length === 1) {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      const input = JSON.parse(body || "{}");
      let parcel;
      try {
        parcel = createParcel(input);
      } catch (err) {
        if (err instanceof RangeError) {
          return json(res, 400, { error: err.message });
        }
        throw err;
      }
      json(res, 201, { parcel, quotePence: quote(parcel) });
    });
    return;
  }

  if (req.method === "GET" && parts[0] === "parcels" && parts.length === 2) {
    const parcel = getParcel(parts[1]);
    if (!parcel) return json(res, 404, { error: "No such parcel" });
    return json(res, 200, { parcel, quotePence: quote(parcel) });
  }

  if (req.method === "POST" && parts[0] === "parcels" && parts[2] === "advance") {
    const parcel = advanceParcel(parts[1]);
    if (!parcel) return json(res, 404, { error: "No such parcel" });
    return json(res, 200, { parcel });
  }

  json(res, 404, { error: "Not found" });
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`parcel-tracker listening on ${PORT}`);
  });
}
