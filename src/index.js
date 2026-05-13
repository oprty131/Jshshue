import { Redis } from "@upstash/redis/cloudflare";

const last_messages = new Map();

function is_spamming(player) {
    const now = Date.now() / 1000;

    if (!last_messages.has(player)) {
        last_messages.set(player, []);
    }

    let times = last_messages.get(player);

    times = times.filter(t => now - t < 1);

    if (times.length >= 5) {
        last_messages.set(player, times);
        return true;
    }

    times.push(now);

    last_messages.set(player, times);

    return false;
}

export default {
    async fetch(request, env) {
        const redis = Redis.fromEnv(env);

        const url = new URL(request.url);

        if (url.pathname === "/send2" && request.method === "POST") {
            const data = await request.json();

            const player = data.player;
            const message = data.message;
            const mode = data.mode;
            const server = data.server;

            if (!player || !message) {
                return new Response("Invalid", {
                    status: 400
                });
            }

            if (message.length > 200) {
                return new Response("Too long", {
                    status: 400
                });
            }

            if (is_spamming(player)) {
                return new Response("Rate limited", {
                    status: 429
                });
            }

            const msg = {
                player,
                message,
                mode,
                server,
                time: Date.now() / 1000
            };

            await redis.rpush(
                "messages",
                JSON.stringify(msg)
            );

            return Response.json({
                status: "ok"
            });
        }

        if (url.pathname === "/messages2") {
            const mode = url.searchParams.get("mode");

            const server = url.searchParams.get("server");

            const after = parseFloat(
                url.searchParams.get("after") || "0"
            );

            const raw = await redis.lrange(
                "messages",
                0,
                -1
            );

            const now = Date.now() / 1000;

            let rows = raw
                .map(JSON.parse)
                .filter(m => now - m.time < 0.97);

            await redis.del("messages");

            if (rows.length > 0) {
                await redis.rpush(
                    "messages",
                    ...rows.map(m =>
                        JSON.stringify(m)
                    )
                );
            }

            rows = rows.filter(
                m => m.time > after
            );

            if (mode === "Server") {
                rows = rows.filter(
                    m => m.server === server
                );
            }

            rows.sort(
                (a, b) => a.time - b.time
            );

            return Response.json(
                rows.map(row => ({
                    player: row.player,
                    message: row.message,
                    time: row.time
                }))
            );
        }

        return new Response("OK");
    }
};
