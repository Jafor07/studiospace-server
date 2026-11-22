import "dotenv/config";
import express from "express";
import cors from "cors";
import { getDb } from "./lib/db.js";
import studiosRouter from "./routes/studios.js";
import wishlistRouter from "./routes/wishlist.js";
import bookingsRouter from "./routes/bookings.js";

const app = express();
const PORT = process.env.PORT || 8000;

app.use(
  cors({
    origin: process.env.CLIENT_URL
      ? process.env.CLIENT_URL.trim().replace(/\/+$/, "")
      : true,
  }),
);
app.use(express.json({ limit: "1mb" }));

app.get("/", (req, res) => {
  res.json({ message: "StudioSpace server is running fine!" });
});

// A simple "is the server and database alive?" check. It shares no details.
app.get("/health", async (req, res) => {
  try {
    const db = await getDb();
    await db.command({ ping: 1 });
    res.json({ ok: true });
  } catch (error) {
    console.error("Health check failed:", error.message);
    res.status(503).json({ ok: false });
  }
});

app.use(studiosRouter);
app.use(wishlistRouter);
app.use(bookingsRouter);

// Unknown route
app.use((req, res) => {
  res.status(404).json({ message: "Route not found." });
});

// Any error that was not handled inside a route ends up here
app.use((error, req, res, next) => {
  console.error("Unhandled server error:", error);
  res.status(500).json({ message: "Something went wrong on the server." });
});

// On Vercel the platform starts the server for us
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
  });
}

export default app;
