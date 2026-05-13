import { Redis } from "@upstash/redis/cloudflare";

const last_messages = new Map();

function is_spamming(player) {
  const now = Date.now() / 1000;

  if (!last_messages.has(player)) {
    last_messages.set(player, []);
  }

  let times = last_messages.get(player);
  times = times.filter(t => now - t < 1);

  if (times.length >= 5) return true;

  times.push(now);
  last_messages.set(player, times);

  return false;
}

export default {
  async fetch(request, env) {
    const redis = Redis.fromEnv(env);
    const url = new URL(request.url);

    if (url.pathname === "/send" && request.method === "POST") {
      const data = await request.json();

      const player = data.player;
      const message = data.message;
      const mode = data.mode;
      const server = data.server;

      if (!player || !message) {
        return new Response("Invalid", { status: 400 });
      }

      if (message.length > 200) {
        return new Response("Too long", { status: 400 });
      }

      if (is_spamming(player)) {
        return new Response("Rate limited", { status: 429 });
      }

      const msg = {
        player,
        message,
        mode,
        server,
        time: Date.now() / 1000
      };

      await redis.publish("chat", JSON.stringify(msg));

      return Response.json({ status: "sent" });
    }

    if (url.pathname === "/messages") {
      const raw = await redis.lrange("live", -20, -1);

      let rows = (raw || [])
        .map(x => {
          try {
            return typeof x === "string" ? JSON.parse(x) : x;
          } catch {
            return null;
          }
        })
        .filter(Boolean);

      return Response.json(rows);
    }

    return new Response("OK");
  }
};
