export default {
  async fetch(request, env) {
    const id = env.CHAT.idFromName("global");
    const stub = env.CHAT.get(id);
    return stub.fetch(request);
  }
};
