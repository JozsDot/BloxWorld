// BloxShoot multiplayer relay - Cloudflare Worker + Durable Object (free tier)
const MAX_PLAYERS = 12;
const MAX_MESSAGE_BYTES = 4096;
const ROOM_PATTERN = /^[A-Z0-9_-]{3,16}$/;

export class GameRoom {
  constructor(ctx, env) { this.ctx = ctx; this.env = env; }

  async fetch(request) {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("WebSocket upgrade required", { status: 426 });
    }
    if (this.ctx.getWebSockets().length >= MAX_PLAYERS) {
      return new Response("Room is full", { status: 429 });
    }
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ playerId: null });
    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketMessage(ws, message) {
    if (typeof message !== "string" || message.length > MAX_MESSAGE_BYTES) {
      ws.close(1009, "Message too large");
      return;
    }
    let data;
    try { data = JSON.parse(message); } catch { ws.close(1003, "Invalid JSON"); return; }
    const attachment = ws.deserializeAttachment() || {};
    if (data.type === "join") {
      const id = String(data.playerId || "").slice(0, 64);
      if (!/^[a-zA-Z0-9-]{8,64}$/.test(id)) { ws.close(1008, "Invalid player id"); return; }
      attachment.playerId = id;
      ws.serializeAttachment(attachment);
      this.broadcast({ type: "join", playerId: id }, ws);
      return;
    }
    if (data.type === "state" && attachment.playerId) {
      const p = data.player || {};
      if (![p.x, p.z, p.yaw].every(Number.isFinite)) return;
      const safe = {
        x: Math.max(-58, Math.min(58, p.x)),
        z: Math.max(-112, Math.min(26, p.z)),
        yaw: Math.max(-1000, Math.min(1000, p.yaw)),
        health: Math.max(0, Math.min(100, Number(p.health) || 0)),
        weapon: String(p.weapon || "").slice(0, 24),
        aiming: Boolean(p.aiming)
      };
      this.broadcast({ type: "state", playerId: attachment.playerId, player: safe }, ws);
    }
  }

  webSocketClose(ws) {
    const attachment = ws.deserializeAttachment() || {};
    if (attachment.playerId) this.broadcast({ type: "leave", playerId: attachment.playerId }, ws);
  }

  webSocketError(ws) {
    const attachment = ws.deserializeAttachment() || {};
    if (attachment.playerId) this.broadcast({ type: "leave", playerId: attachment.playerId }, ws);
  }

  broadcast(data, except) {
    const message = JSON.stringify(data);
    for (const socket of this.ctx.getWebSockets()) {
      if (socket !== except) {
        try { socket.send(message); } catch {}
      }
    }
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/health") {
      return Response.json({ ok: true, service: "BloxShoot multiplayer", maxPlayersPerRoom: MAX_PLAYERS });
    }
    const match = url.pathname.match(/^\/room\/([A-Z0-9_-]{3,16})$/);
    if (!match || !ROOM_PATTERN.test(match[1])) return new Response("BloxShoot server ready", { status: 200 });
    const id = env.GAME_ROOMS.idFromName(match[1]);
    return env.GAME_ROOMS.get(id).fetch(request);
  }
};
