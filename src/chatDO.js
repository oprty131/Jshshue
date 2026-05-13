export class ChatRoom {
  constructor(state) {
    this.state = state;
    this.clients = new Set();
    this.messages = [];
    this.seq = 0;
  }

  async fetch(request) {
    const upgrade = request.headers.get("Upgrade");

    if (upgrade === "websocket") {
      return this.handleWebSocket(request);
    }

    return this.handleHttp(request);
  }

  async handleHttp(request) {
    const url = new URL(request.url);

    if (url.pathname === "/send") {
      const data = await request.json();

      const msg = {
        id: crypto.randomUUID(),
        seq: ++this.seq,
        player: data.player,
        message: data.message,
        server: data.server,
        time: Date.now()
      };

      this.messages.push(msg);
      if (this.messages.length > 40) this.messages.shift();

      for (const ws of this.clients) {
        ws.send(JSON.stringify(msg));
      }

      return Response.json({ ok: true });
    }

    if (url.pathname === "/messages") {
      return Response.json(this.messages);
    }

    return new Response("OK");
  }

  async handleWebSocket(request) {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    server.accept();
    this.clients.add(server);

    server.addEventListener("message", (event) => {
      const data = JSON.parse(event.data);

      const msg = {
        id: crypto.randomUUID(),
        seq: ++this.seq,
        player: data.player,
        message: data.message,
        server: data.server,
        time: Date.now()
      };

      this.messages.push(msg);
      if (this.messages.length > 40) this.messages.shift();

      for (const ws of this.clients) {
        ws.send(JSON.stringify(msg));
      }
    });

    server.addEventListener("close", () => {
      this.clients.delete(server);
    });

    return new Response(null, {
      status: 101,
      webSocket: client
    });
  }
}
