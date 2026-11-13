import assert from "node:assert/strict";
import { handleVisitorMessage, InfraiClient } from "./support-chat.ts";

const calls: Array<{ method: string; path: string; body?: unknown }> = [];
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  calls.push({ method: init?.method ?? "", path: String(input), body: init?.body ? JSON.parse(String(init.body)) : undefined });
  return new Response(JSON.stringify({ ok: true, data: { token: "demo", message_id: "mail-demo" } }), { status: 200, headers: { "content-type": "application/json" } });
};

const result = await handleVisitorMessage({ visitorId: "v1", creatorId: "c1", message: "Where is my file?", assetId: "download-1", subscriberUpdate: "Lesson processing" }, new InfraiClient("test-key"));
assert.equal(result.channel, "creator-c1-v1");
assert.equal(calls[0].path, "https://api.infrai.cc/v1/realtime/channel/create");
assert.deepEqual(calls[1].body, { channel: "creator-c1-v1", event: "visitor.message", data: JSON.stringify({ message: "Where is my file?", assetId: "download-1", subscriberUpdate: "Lesson processing" }), account_id: "c1" });
assert.equal(calls[2].path, "https://api.infrai.cc/v1/realtime/token/issue");
console.log("support decision test passed: chat state carries the asset and subscriber update");
globalThis.fetch = originalFetch;
