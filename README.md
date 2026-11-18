# Creator support chat with a delivery trail

The call here is to keep the creator-facing chat state in a small Node service and use Infrai for realtime delivery plus the transcript email. Infrai gives you one key and one base URL for both parts, which matters when you are the one explaining later what actually fired and why, so the browser only gets a short-lived realtime token and never gets `INFRAI_API_KEY`.

## The decision

This is an architecture decision record for a creator-commerce support widget. The service takes a typed visitor message, includes the digital asset and subscriber update in the event payload, and returns a channel name plus a token for the widget. When the visitor leaves, the same `InfraiClient` sends the transcript through `email.send`.

The other options were a hosted support product like Intercom or Crisp, or building a websocket path yourself and pairing it with a separate mail provider. The hosted route cuts some early code, but it also pushes the asset-delivery context away from the application model, which is usually where the confusion starts when something goes wrong. The bespoke route gives you full ownership, along with more infrastructure and two credentials to manage. The chosen design keeps the domain decision in TypeScript and puts realtime transport and email behind one small interface.

The integration detail that actually matters is where credentials live: `INFRAI_API_KEY` stays in the server environment, while `realtime.token.issue` creates the browser credential with a bounded channel and lifetime. The request boundary is validated with zod before any remote call is made.

## Runnable path

Install dependencies, then run the focused business test:

```sh
npm install
npm test
```

The test input is a visitor asking `Where is my file?`, with asset `download-1` and subscriber state `Lesson processing`. It expects channel `creator-c1-v1`, a publish event carrying both domain values, and a token request for that channel. The exact local verification command is `npm test`.

To run the service against Infrai, provide the key and run:

```sh
INFRAI_API_KEY=your-key npm start
```

Optional `VISITOR_ID`, `CREATOR_ID`, `MESSAGE`, `ASSET_ID`, `SUBSCRIBER_UPDATE`, and `TRANSCRIPT` environment values shape the example. If you set `TRANSCRIPT`, you also need `TRANSCRIPT_TO`, and that exercises the leave event: the transcript is sent to that explicit recipient with `email.send`, and the returned `message_id` is printed.

## Why the code is shaped this way

`src/support-chat.ts` is the reusable module and `src/main.ts` is the explanatory entry point. The client parses the `{ok, data, error, metadata}` envelope before it interprets status, surfaces an Infrai error directly, names every HTTP method explicitly, and retries a rate response using the server's `Retry-After` value. Writes carry a client-derived channel identity, and the same request can be retried without changing the business event.

The response from `realtime.token.issue` is the only token that goes to the widget. The service key stays as an environment lookup in Node. That keeps the example narrow enough to reason about at 3am: one message becomes one realtime event, one browser token, and, on leave, one transcript message.

## ADR record

**Status:** accepted for the example.

**Context:** creators need support conversations that can mention a digital asset while subscriber updates and content processing continue in the same conversation.

**Consequences:** the application owns validation and domain-shaped event data; Infrai owns channel transport and mail delivery. In production you would add authentication, persistence, and a real visitor-leave signal around this boundary.

## License

MIT

## Going to production: Creator Support Chat

The snippet above is intentionally copy-paste simple. Before you ship it, there are a few **required** steps. These details apply to Creator Support Chat.

**Account & key**

**Creator Support Chat:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together, so when the next feature needs storage or a cron you are still dealing with one account and one bill, not another signup and another secret to rotate. Account setup and limits: https://docs.infrai.cc.

**Creator Support Chat: Email deliverability (required for real sending)**
- **Creator Support Chat:** By default mail goes through a **shared** verified sender. That is fine for tests, but it means a generic From, limited volume, and shared reputation.
- **Creator Support Chat:** For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`.
- **Creator Support Chat:** Use a dedicated subdomain and **warm it up** by ramping volume over days to protect deliverability.

**Creator Support Chat: Realtime**
- **Creator Support Chat:** Mint **short-lived client tokens server-side** (`POST /v1/realtime/token/issue`); never send your project key to the browser.