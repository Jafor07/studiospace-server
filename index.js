import "dotenv/config";
import express from "express";
import cors from "cors";
import studiosRouter from "./routes/studios.js";
import wishlistRouter from "./routes/wishlist.js";

const app = express();
const PORT = process.env.PORT || 8000;

app.use(cors({ origin: process.env.CLIENT_URL || true }));
app.use(express.json({ limit: "1mb" }));

app.get("/", (req, res) => {
  res.json({ message: "StudioSpace server is running fine!" });
});

app.use(studiosRouter);
app.use(wishlistRouter);

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
