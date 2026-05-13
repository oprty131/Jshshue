import { Redis } from "@upstash/redis/cloudflare";

export default {
  async fetch(request, env) {
    const redis = Redis.fromEnv(env);
    const url = new URL(request.url);

    if (url.pathname === "/send" && request.method === "POST") {
      try {
        const data = await request.json();

        const player = String(data.player || "").trim().slice(0, 32);
        const message = String(data.message || "").trim().slice(0, 200);
        const mode = String(data.mode || "Global").slice(0, 20);
        const server = String(data.server || "").slice(0, 100);

        if (!player || !message) {
          return new Response("Invalid", { status: 400 });
        }

        const spamKey = `spam:${player}`;
        const spamCount = await redis.incr(spamKey);

        if (spamCount === 1) {
          await redis.expire(spamKey, 1);
        }

        if (spamCount > 5) {
          return new Response("Rate limited", { status: 429 });
        }

        const msg = {
          player,
          message,
          mode,
          server,
          time: Math.floor(Date.now() / 1000)
        };

        await redis.rpush("messages", JSON.stringify(msg));

        await redis.ltrim("messages", -40, -1);

        return Response.json({
          status: "ok"
        });
      } catch {
        return new Response("Bad Request", { status: 400 });
      }
    }

    if (url.pathname === "/messages") {
      try {
        const mode = url.searchParams.get("mode");
        const server = url.searchParams.get("server");
        const after = parseFloat(url.searchParams.get("after") || "0");

        const raw = await redis.lrange("messages", -40, -1);

        let rows = raw
          .map(x => {
            try {
              return typeof x === "string" ? JSON.parse(x) : x;
            } catch {
              return null;
            }
          })
          .filter(Boolean);

        const now = Math.floor(Date.now() / 1000);

        rows = rows.filter(m => now - m.time < 300);

        rows = rows.filter(m => m.time > after);

        if (mode === "Server") {
          rows = rows.filter(m => m.server === server);
        }

        rows.sort((a, b) => a.time - b.time);

        return Response.json(rows);
      } catch {
        return new Response("Bad Request", { status: 400 });
      }
    }

    return new Response("OK");
  }
};
