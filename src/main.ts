import { InfraiClient, handleVisitorMessage, emailTranscript } from "./support-chat.ts";

const key = process.env.INFRAI_API_KEY;
if (!key) throw new Error("Set INFRAI_API_KEY before starting the service");

const client = new InfraiClient(key);
const input = {
  visitorId: process.env.VISITOR_ID ?? "visitor-demo",
  creatorId: process.env.CREATOR_ID ?? "creator-demo",
  message: process.env.MESSAGE ?? "I cannot find my digital download",
  assetId: process.env.ASSET_ID ?? "asset-demo",
  subscriberUpdate: process.env.SUBSCRIBER_UPDATE ?? "The new lesson is processing",
};
const session = await handleVisitorMessage(input, client);
console.log(JSON.stringify({ event: "chat.started", ...session }));
if (process.env.TRANSCRIPT) {
  const recipient = process.env.TRANSCRIPT_TO;
  if (!recipient) throw new Error("Set TRANSCRIPT_TO before sending a transcript");
  const messageId = await emailTranscript(input, process.env.TRANSCRIPT, recipient, client);
  console.log(JSON.stringify({ event: "transcript.sent", messageId }));
}
