import { Router } from "express";
import { getCollections } from "../lib/db.js";
import { verifyToken } from "../middleware/verifyToken.js";
import { toObjectId } from "../lib/helpers.js";

const router = Router();

// GET /wishlist -> the ids of every studio the user saved
router.get("/wishlist", verifyToken, async (req, res) => {
  const { wishlist } = await getCollections();
  const rows = await wishlist.find({ userEmail: req.user.email }).toArray();
  res.json(rows.map((row) => row.studioId.toString()));
});

// GET /wishlist/studios -> the saved studios themselves
router.get("/wishlist/studios", verifyToken, async (req, res) => {
  const { wishlist, studios } = await getCollections();
  const rows = await wishlist
    .find({ userEmail: req.user.email })
    .sort({ createdAt: -1 })
    .toArray();

  const found = await studios
    .find({ _id: { $in: rows.map((row) => row.studioId) } })
    .project({ reviews: 0 })
    .toArray();

  // Keep "most recently saved first"
  const byId = new Map(found.map((studio) => [studio._id.toString(), studio]));
  res.json(
    rows.map((row) => byId.get(row.studioId.toString())).filter(Boolean),
  );
});

// POST /wishlist/:studioId -> heart on, heart off (toggle)
router.post("/wishlist/:studioId", verifyToken, async (req, res) => {
  const studioId = toObjectId(req.params.studioId);
  if (!studioId) return res.status(404).json({ message: "Studio not found." });

  const { wishlist, studios } = await getCollections();
  const filter = { userEmail: req.user.email, studioId };

  const existing = await wishlist.findOne(filter);
  if (existing) {
    await wishlist.deleteOne(filter);
    return res.json({ saved: false, message: "Removed from your saved studios." });
  }

  const studio = await studios.findOne({ _id: studioId });
  if (!studio) return res.status(404).json({ message: "Studio not found." });

  await wishlist.insertOne({ ...filter, createdAt: new Date() });
  res.status(201).json({ saved: true, message: "Saved to your wishlist." });
});

export default router;
