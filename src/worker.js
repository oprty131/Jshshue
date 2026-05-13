export default {
  async fetch(request, env) {
    if (request.headers.get("Upgrade") === "websocket") {
      const id = env.CHAT.idFromName("global");
      const stub = env.CHAT.get(id);
      return stub.fetch(request);
    }

    const id = env.CHAT.idFromName("global");
    const stub = env.CHAT.get(id);
    return stub.fetch(request);
  }
};
