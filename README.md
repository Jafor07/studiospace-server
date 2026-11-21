# StudioSpace Server

Express and MongoDB API for **StudioSpace**, a peer-to-peer creative studio booking platform.

**Client repository:** https://github.com/YOUR_USERNAME/studiospace-client
**Live API:** https://YOUR-SERVER-NAME.vercel.app

## How security works

Every private route uses the `verifyToken` middleware. It reads the `Authorization: Bearer <jwt>` header, checks the signature against the public keys the client publishes at `/api/auth/jwks`, and answers **401 Unauthorized** if the token is missing, fake or expired. The logged-in user (`req.user`) comes from the verified token, so owners and guests can never be faked from a request body.

## Endpoints

| Method | Route | Access | What it does |
|---|---|---|---|
| GET | `/studios` | public | List studios (`search`, `category`, `sort`, `minPrice`, `maxPrice`) |
| GET | `/studios/featured` | public | Six top-rated studios (`limit(6)`) |
| GET | `/studios/:id` | public | One studio with its reviews |
| GET | `/my-studios` | token | Studios owned by the logged-in user |
| POST | `/studios` | token | Create a studio |
| PATCH | `/studios/:id` | owner | Update a studio |
| DELETE | `/studios/:id` | owner | Delete a studio and cancel its open bookings |
| POST | `/studios/:id/reviews` | token | Add a review (one per user) |
| POST | `/bookings` | token | Request a booking (`Pending`), rejects clashes with `Confirmed` bookings |
| GET | `/my-bookings` | token | The guest's bookings |
| PATCH | `/bookings/:id/cancel` | guest | Cancel a `Pending` booking |
| GET | `/host-bookings` | token | Requests for the host's studios |
| PATCH | `/bookings/:id/status` | host | Confirm, decline or complete a booking |
| GET | `/wishlist` | token | Ids of saved studios |
| GET | `/wishlist/studios` | token | Saved studios |
| POST | `/wishlist/:studioId` | token | Save or unsave a studio |

## Double-booking prevention

Two time ranges overlap when each starts before the other ends: `startMin < newEnd && endMin > newStart`. The server runs this check against `Confirmed` bookings of the same studio and date when a booking is created and again when a host confirms it. A clash returns `409` with a message such as *"This studio is already booked from 10:00 to 12:00 on 2026-11-24."* Back-to-back sessions (one ends when the next starts) are allowed.

## Run it locally

```bash
npm install
cp .env.example .env     # then fill in the values
npm run dev              # http://localhost:8000
npm run seed -- host@studiospace.com "Studio Host"   # optional sample studios
```

| Variable | Meaning |
|---|---|
| `MONGODB_URI` | MongoDB Atlas connection string (same database as the client) |
| `DB_NAME` | Database name, default `studiospace` |
| `CLIENT_URL` | URL of the Next.js client (the JWT public keys are loaded from it) |
| `PORT` | Optional, default `8000` |

## Deploy to Vercel

The included `vercel.json` and the `export default app` in `index.js` are all Vercel needs. Add the environment variables above in the Vercel project settings.
