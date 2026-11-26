# HOSSAM-X Employee Factory — E1

## First WhatsApp employee

E1 receives direct text messages, sends them to Groq for an Arabic Egyptian response, and replies in the same WhatsApp conversation.

## Latest verified checkpoint — 2026-11-26

The user completed a successful live E1 pairing using an isolated clean auth directory and verified a reply to a message sent from another WhatsApp number. See [E1 first successful run and auth incident report](docs/E1_FIRST_SUCCESS_AND_AUTH_INCIDENT_2026-11-26.md).

The clean-session result strongly supports (but does not conclusively prove) the hypothesis that stale partial pairing identity in the previous auth state caused Baileys to take an inappropriate login path. The original auth directory was preserved. The shared source code still requires a deliberate auth-lifecycle fix and tests; this checkpoint does not claim production readiness or prompt-injection safety.

### Requirements
- Node.js 20.6 or newer (Node.js 24 is recommended).
- WhatsApp Business account for the E1 session.
- A Groq API key.

### Local setup (Termux)
1. Install dependencies with npm install.
2. Copy .env.example to .env.
3. Put your Groq key in the local .env file as GROQ_API_KEY=... . Never commit .env.
4. Start E1 with npm run start:e1.
5. On first run, enter the WhatsApp Business phone number in international format and complete the pairing flow shown in Termux.

The default model is openai/gpt-oss-120b. Override it locally with GROQ_MODEL in .env.

### Current E1 behavior
- Direct text messages only; groups, status, newsletters, images, and videos are ignored.
- Duplicate message IDs are ignored in the current process.
- At most two Groq requests run concurrently.
- AI requests time out after 20 seconds and use a fallback reply on failure.
- Unexpected WhatsApp disconnects trigger automatic reconnect attempts with a capped delay.
- A WhatsApp logout still requires manual re-linking.
- The process does not yet configure Android boot startup. Termux:Boot / process supervision is a separate host setup step.

### Important
The .env, runtime/, and node_modules/ paths are ignored by Git. Keep API keys and WhatsApp session data local.
