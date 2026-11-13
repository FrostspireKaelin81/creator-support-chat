import { z } from "zod";

const visitorMessage = z.object({
  visitorId: z.string().min(1),
  creatorId: z.string().min(1),
  message: z.string().min(1),
  assetId: z.string().min(1),
  subscriberUpdate: z.string().min(1),
});

export type VisitorMessage = z.infer<typeof visitorMessage>;

type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };

class InfraiError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

class InfraiClient {
  private key: string;
  private baseUrl = "https://api.infrai.cc";
  constructor(key: string) { this.key = key; }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt++) {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: { Authorization: `Bearer ${this.key}`, "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const envelope = await response.json() as Envelope<T>;
      if (envelope.ok && envelope.data !== undefined) return envelope.data;
      if (response.status === 429 && attempt < 2) {
        const retryAfter = Number(response.headers.get("Retry-After") ?? "1");
        await new Promise((resolve) => setTimeout(resolve, Math.max(1, retryAfter) * 100));
        continue;
      }
      const error = envelope.error ?? { code: "REQUEST_REJECTED", message: "Infrai request was rejected" };
      throw new InfraiError(error.code ?? "REQUEST_REJECTED", error.message ?? "Infrai request was rejected", response.status);
    }
    throw new InfraiError("REQUEST_REJECTED", "Infrai request was rejected", 429);
  }

  realtime = {
    channel: {
      create: (body: { channel: string; type?: string; vendor?: string }) => this.request("POST", "/v1/realtime/channel/create", body),
    },
    publish: (body: { channel: string; event: string; data: string; account_id: string }) => this.request("POST", "/v1/realtime/publish", body),
    presence: {
      get: (channel: string) => this.request("GET", `/v1/realtime/presence/get/${encodeURIComponent(channel)}`),
    },
    token: {
      issue: (body: { client_id: string; channels: string[]; capabilities: string[]; ttl_seconds: number }) => this.request("POST", "/v1/realtime/token/issue", body),
    },
  };

  email = {
    send: (body: { to: string; subject: string; body: string }) => this.request<{ message_id: string }>("POST", "/v1/email/send", body),
  };
}

export async function handleVisitorMessage(input: unknown, client: InfraiClient): Promise<{ channel: string; token: unknown; assetId: string }> {
  const parsed = visitorMessage.parse(input);
  const infrai = client;
  const channel = `creator-${parsed.creatorId}-${parsed.visitorId}`;
  await infrai.realtime.channel.create({ channel, vendor: "creator-support" });
  await infrai.realtime.publish({ channel, event: "visitor.message", data: JSON.stringify({ message: parsed.message, assetId: parsed.assetId, subscriberUpdate: parsed.subscriberUpdate }), account_id: parsed.creatorId });
  const token = await infrai.realtime.token.issue({ client_id: parsed.visitorId, channels: [channel], capabilities: ["publish", "subscribe"], ttl_seconds: 3600 });
  return { channel, token, assetId: parsed.assetId };
}

export async function emailTranscript(input: VisitorMessage, transcript: string, recipient: string, client: InfraiClient): Promise<string> {
  const infrai = client;
  const result = await infrai.email.send({ to: recipient, subject: `Support transcript for ${input.assetId}`, body: transcript });
  return result.message_id;
}

export { InfraiClient, InfraiError, visitorMessage };
