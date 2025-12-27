# Vitalgaurd (SmartSOS)

Predict. Prevent. Protect.

Vitalgaurd (branded in the UI as SmartSOS) is a full‑stack emergency‑response and health‑monitoring application that combines secure MongoDB-based authentication, an AI-powered conversational assistant using Google Generative AI, and SOS alerts delivered over WhatsApp via Twilio. The backend uses a modular routing and controller/service architecture to keep responsibilities clear and make the system easy to extend.

This README was updated to reflect the recent changes:
- MongoDB (Mongoose) for signup & login
- Google Generative AI (GoogleGenAI) as the chatbot backend
- Twilio WhatsApp for SOS alerts
- Improved modular routing and middleware layers

Live UI screenshots (place the provided screenshots in the repository at the paths below so they render in this README):
- Screenshot 1 (Homepage / Marketing Hero): assets/screenshots/1.png  
  ![Image 1 — Homepage hero / marketing](/assets/screenshots/1.png)
  *Caption: Marketing hero and sample health dashboard card.*
- Screenshot 2 (Patient dashboard / live vitals): assets/screenshots/2.png  
  ![Image 2 — Patient dashboard / live vitals](/assets/screenshots/2.png)
  *Caption: Patient dashboard showing live vitals, wellness cards, and SOS button.*

> Note: The images above correspond to the screenshots you provided. Add the files exactly at `assets/screenshots/1.png` and `assets/screenshots/2.png` (or update the paths below) to display them.

Table of contents
- Features
- Tech stack
- Architecture overview
- Getting started
  - Prerequisites
  - Environment variables
  - Local setup (backend & frontend)
  - Docker (optional)
- API reference (summary)
  - Authentication
  - Chat (GoogleGenAI)
  - SOS Alerts (Twilio — WhatsApp)
- Database models (high-level)
- Routing & middleware
- Security considerations
- Testing
- Deployment
- Troubleshooting
- Contributing
- License

Features
- Secure user signup/login backed by MongoDB (Mongoose)
- JWT authentication with refresh token flow
- Google Generative AI (GenAI) chatbot as a conversational assistant (server-side)
- SOS dispatch via Twilio WhatsApp (one‑tap SOS + programmatic sends)
- Improved modular routing, controllers, and services for separation of concerns
- Alert audit trail persisted to DB (alerts collection)
- Optional audit/logging for chat & alerts

Tech stack
- Backend: Node.js, Express, Mongoose
- Frontend: React (assumed) — update based on repo implementation
- Database: MongoDB (Atlas or self-hosted)
- Chat / AI: Google Generative AI (GenAI)
- Notification: Twilio (WhatsApp)
- Auth: bcrypt, JWT
- Optional: Redis + BullMQ for background job queueing (recommended for large volumes)

Architecture overview
- Frontend (React) <--> Backend (Express REST API)
- Backend structure (recommended)
  - routes/ — Express routers (authRouter, chatRouter, alertsRouter, userRouter, etc.)
  - controllers/ — Accept HTTP requests and call services
  - services/ — Business logic (AuthService, TwilioService, GenAIService)
  - models/ — Mongoose models (User, Alert, ChatMessage)
  - middleware/ — auth, validation, rate-limiter, error handler
  - utils/ — helpers, logging, external API wrappers

Getting started

Prerequisites
- Node.js 18+ (or tested LTS)
- npm or yarn
- MongoDB (Atlas recommended) or local instance
- Twilio account with WhatsApp sandbox or approved WhatsApp sender
- Google Cloud project with Generative AI API enabled (or GenAI access)

Environment variables
Create a `.env` file at the backend root. Example `.env.example` template:

MONGODB
```
MONGODB_URI=mongodb+srv://<user>:<pass>@cluster0.mongodb.net/vitalgaurd?retryWrites=true&w=majority
```

APP & AUTH
```
PORT=4000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

JWT_SECRET=replace_with_a_long_random_string
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d
```

GOOGLE GENERATIVE AI
```
# Option A: API key
GOOGLE_GENAI_API_KEY=your_google_genai_api_key

# Option B (preferred for service accounts): use GOOGLE_APPLICATION_CREDENTIALS to point to a service account JSON file
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
```

TWILIO
```
TWILIO_ACCOUNT_SID=ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
SOS_RECIPIENTS=whatsapp:+1234567890,whatsapp:+1098765432
```

OPTIONAL
```
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=100
LOG_LEVEL=info
```

Local setup (backend & frontend)
1. Clone
   - git clone https://github.com/Sourish-19/Vitalgaurd.git
   - cd Vitalgaurd

2. Backend
   - cd backend (or server — adjust if folder differs)
   - cp .env.example .env (or create `.env`) and fill values
   - npm install
   - npm run dev  # starts dev server with nodemon
   - npm run start  # production

3. Frontend
   - cd frontend
   - npm install
   - cp .env.example .env (if the frontend uses env vars)
   - npm run start

Using Docker (optional)
Example: start a local MongoDB container:

docker-compose.yml (example snippet)
```yaml
version: "3.8"
services:
  mongo:
    image: mongo:6
    restart: unless-stopped
    volumes:
      - mongo-data:/data/db
    ports:
      - "27017:27017"

volumes:
  mongo-data:
```

API reference (summary)
Note: adapt paths to your implementation.

Authentication
- POST /api/auth/signup
  - Body: { name, email, password, phone? }
  - Response: { user: { id, name, email }, token, refreshToken }

- POST /api/auth/signin
  - Body: { email, password }
  - Response: { user, token, refreshToken }

- POST /api/auth/refresh
  - Body: { refreshToken }
  - Response: { token, refreshToken }

- POST /api/auth/logout
  - Body: { refreshToken } — invalidates refresh token

Key notes:
- Hash passwords with bcrypt before saving
- Store refresh tokens (hashed) or maintain a allowlist/denylist depending on design

Chatbot (Google Generative AI)
- POST /api/chat
  - Auth: Bearer token (recommended)
  - Body: { message, sessionId? }
  - Response: { reply, modelMetadata? }

Example server-side pseudocode (Node.js)
```js
// genai.service.js - simplified
const { GoogleAuth } = require('google-auth-library'); // or use official GenAI client
async function generateReply(prompt) {
  // call Google GenAI with API key or service account
  // return reply string
}
```

Best practices:
- Keep Google credentials server-side
- If streaming responses, implement a streaming proxy to the client
- Log chat interactions to ChatMessages collection for audit/analytics (if desired)

SOS Alerts (Twilio WhatsApp)
- POST /api/alerts/sos
  - Auth: Bearer token
  - Body: { message, location?: { lat, lng, address }, userId? }
  - Response: { success: true, alertId, twilioResponses: [...] }

Server flow:
1. Validate request & user
2. Persist Alert with status `queued`
3. Use Twilio REST API to send WhatsApp messages to recipients configured in SOS_RECIPIENTS
4. Update Alert with delivery result(s) and timestamps

Example Node.js snippet (twilio)
```js
const twilioClient = require('twilio')(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

async function sendWhatsApp(recipient, body) {
  return twilioClient.messages.create({
    from: process.env.TWILIO_WHATSAPP_FROM, // e.g. "whatsapp:+14155238886"
    to: recipient, // e.g. "whatsapp:+1234567890"
    body,
  });
}
```

Database models (high-level)
- User
  - _id, name, email, passwordHash, phone, roles, createdAt, lastSeen

- Alert
  - _id, userId, message, location, status (queued|sent|failed), recipients[], twilioResponses[], createdAt, updatedAt

- ChatMessage (optional)
  - _id, userId, sessionId, userMessage, botReply, model, metadata, createdAt

Routing & middleware
- Use small routers per domain: authRouter, userRouter, chatRouter, alertsRouter
- Controllers should be thin: parse request → call services → format response
- Services encapsulate business logic and external API calls (TwilioService, GenAIService)
- Middleware:
  - validation (AJV, Joi, or express-validator)
  - authentication (JWT verification)
  - rate-limiter (express-rate-limit)
  - error handler (centralized)
  - request logging (morgan or custom)

Security considerations
- Do not commit .env or credentials to the repo
- Use HTTPS in production and configure CORS origins to only trusted frontends
- Rate-limit sensitive endpoints (auth, chat, sos)
- Use strong, rotated API keys and service account credentials for Google & Twilio
- Sanitize inputs to prevent injection attacks
- Consider hashed/rotating refresh tokens for user sessions
- Limit Twilio recipients and validate numbers before sending

Testing
- Unit tests for services (mock external APIs)
- Integration tests against a test MongoDB (mongodb-memory-server recommended)
- Mock Twilio & GenAI in CI to avoid real external calls
- End-to-end (optional) to cover signup → auth → chat → SOS send flows (with mocks)

Deployment
- Backend: deploy to Heroku, Render, Vercel (serverless), AWS, GCP, or DigitalOcean
- Frontend: deploy to Vercel, Netlify, or any static host
- Use managed MongoDB Atlas for production
- Set secrets using your host's secret manager (do not store in repository)
- For heavy SOS usage, offload deliveries to a background queue and worker processes

Troubleshooting
- MongoDB connection errors: verify MONGODB_URI and network whitelist (Atlas)
- Twilio errors: check Twilio console for error codes and ensure WhatsApp sandbox/approved sender is configured
- Google GenAI errors: ensure API enabled and credentials valid
- Token issues: verify JWT_SECRET and token expiry configuration match across services
- If Twilio messages fail silently, log Twilio response error objects to investigate

Contributing
- Fork repository → create feature branch → open PR
- Follow repo linting and formatting rules
- Write tests for new features (mock external services)
- Use branch naming: feat/<short-desc>, fix/<issue>-<short-desc>

Repository structure (recommended)
```
/backend
  /controllers
  /services
  /models
  /routes
  /middleware
  app.js
/frontend
  src/
  public/
  ...
/assets/screenshots/1.png
/assets/screenshots/2.png
README.md
```

Operational recommendations & next steps
- Add background job queue for bulk/async SOS (BullMQ + Redis)
- Add observability: Sentry for errors, Prometheus/Grafana for metrics
- Implement RBAC (roles: user, responder, admin) if needed
- Add E2E test suite that mocks Twilio and GenAI
- Add rate limiting & abuse detection on SOS endpoint to avoid spam

Acknowledgements & links
- Twilio WhatsApp: https://www.twilio.com/whatsapp
- Google Generative AI: https://cloud.google.com/generative-ai
- MongoDB Atlas: https://www.mongodb.com/cloud/atlas

Maintainer / Contact
- Repository: https://github.com/Sourish-19/Vitalgaurd
- Maintainer: Sourish-19

License
- Add your preferred license (e.g., MIT). Update the LICENSE file accordingly.

Changelog (summary of the latest update)
- Implemented MongoDB for user signup & login (Mongoose)
- Integrated Google Generative AI for the chatbot
- Integrated Twilio WhatsApp for SOS alerting
- Reworked routing into modular routers and services
- Added audit-persistent alerts and basic logging for SOS flows

 