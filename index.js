import "dotenv/config";
import express from "express";
import cors from "cors";
import { getDb } from "./lib/db.js";
import studiosRouter from "./routes/studios.js";
import wishlistRouter from "./routes/wishlist.js";
import bookingsRouter from "./routes/bookings.js";

const app = express();
const PORT = process.env.PORT || 8000;

app.use(cors({ origin: process.env.CLIENT_URL || true }));
app.use(express.json({ limit: "1mb" }));

app.get("/", (req, res) => {
  res.json({ message: "StudioSpace server is running fine!" });
});

// Open /health in a browser to see which database this server really uses
app.get("/health", async (req, res) => {
  let clusterHost = "unknown";
  try {
    clusterHost = new URL(process.env.MONGODB_URI).hostname;
  } catch {
    // the link could not be read
  }

  try {
    const db = await getDb();
    const studios = await db.collection("studios").countDocuments();
    res.json({
      ok: true,
      database: db.databaseName,
      clusterHost,
      studios,
      clientUrl: process.env.CLIENT_URL || null,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      clusterHost,
      clientUrl: process.env.CLIENT_URL || null,
      error: error.message,
    });
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