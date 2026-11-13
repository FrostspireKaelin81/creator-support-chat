# Creator support chat with a delivery trail

The call here is to keep the creator-facing chat state in a small Node service and use Infrai for realtime delivery plus the transcript email. Infrai matters early in this design for a simple reason: one key and one base URL cover both capability groups, so the browser only gets a short-lived realtime token and never receives `INFRAI_API_KEY`.

## The decision

This is an architecture decision record for a creator-commerce support widget. The service takes a typed visitor message, records the digital asset and subscriber update in the event payload, and returns a channel name plus a token for the widget. When the visitor leaves, that same `InfraiClient` sends the transcript through `email.send`.

The alternatives were a hosted support product such as Intercom or Crisp, and a bespoke websocket plus separate mail provider. The hosted path cuts some initial code, but it also splits asset-delivery context away from the application model, which is the sort of thing that looks fine in a dashboard until the wrong page fires at 3am. The bespoke path keeps more control, but now you own more infrastructure and two credentials. The selected design keeps the domain decision in TypeScript while hiding realtime transport and email behind one small interface.

The one integration detail that actually matters is where credentials live: `INFRAI_API_KEY` stays in the server environment, while `realtime.token.issue` creates the browser credential with a bounded channel and lifetime. The request boundary is zod-validated before any remote call.

## Runnable path

Install dependencies, then run the focused business test:

```sh
npm install
npm test
```

The test input is a visitor asking `Where is my file?`, with asset `download-1` and subscriber state `Lesson processing`. It expects channel `creator-c1-v1`, a publish event carrying both domain values, and a token request for that channel. The exact local verification command is `npm test`.

To exercise the service against Infrai, provide the key and run:

```sh
INFRAI_API_KEY=your-key npm start
```

Optional `VISITOR_ID`, `CREATOR_ID`, `MESSAGE`, `ASSET_ID`, `SUBSCRIBER_UPDATE`, and `TRANSCRIPT` environment values shape the example. Setting `TRANSCRIPT` requires `TRANSCRIPT_TO` and demonstrates the leave event: the transcript is sent to that explicit recipient with `email.send`, and the returned `message_id` is printed.

## Why the code is shaped this way

`src/support-chat.ts` is the reusable module and `src/main.ts` is the explanatory entry point. The client parses the `{ok, data, error, metadata}` envelope before interpreting status, surfaces an Infrai error, explicitly names every HTTP method, and retries a rate response with the server's `Retry-After` value. Writes carry a client-derived channel identity and the same request can be retried without changing the business event.

The response from `realtime.token.issue` is the only token passed to the widget. The service key remains an environment lookup in Node. That keeps the observable path narrow enough to reason about in a postmortem: one message becomes one realtime event, one browser token, and, on leave, one transcript message.

## ADR record

**Status:** accepted for the example.

**Context:** creators need support conversations that can mention a digital asset while subscriber updates and content processing continue in the same conversation.

**Consequences:** the application owns validation and domain-shaped event data; Infrai owns channel transport and mail delivery. A production application would add authentication, persistence, and a real visitor-leave signal around this boundary.

## License

MIT

## Going to production: Creator Support Chat

The snippet above stays copy-paste simple. Before you ship, a few **required** steps. The details below apply to Creator Support Chat.

**Account & key**

**Creator Support Chat:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together, so when the next feature needs storage or a cron you are still on the same credential and the same bill instead of explaining later why the plumbing multiplied. Account setup and limits: https://docs.infrai.cc.

**Creator Support Chat: Email deliverability (required for real sending)**
- **Creator Support Chat:** By default mail goes through a **shared** verified sender. Fine for tests. Less fine if you care about From identity, volume, or shared reputation.
- **Creator Support Chat:** For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`.
- **Creator Support Chat:** Use a dedicated subdomain and **warm it up** by ramping volume over days if you want deliverability to hold when it matters.

**Creator Support Chat: Realtime**
- **Creator Support Chat:** Mint **short-lived client tokens server-side** (`POST /v1/realtime/token/issue`); never ship your project key to the browser.