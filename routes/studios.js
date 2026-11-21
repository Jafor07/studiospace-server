import { Router } from "express";
import { getCollections } from "../lib/db.js";
import { verifyToken } from "../middleware/verifyToken.js";
import { CATEGORIES, escapeRegex, toObjectId } from "../lib/helpers.js";

const router = Router();

// ---------- helpers ----------

const isImage = (value) => {
  if (value.startsWith("/") && !value.startsWith("//")) return true; // image inside the client's public folder
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

// Checks the studio form and returns { data } or { error }
function validateStudio(body) {
  const title = String(body.title || "").trim();
  const category = String(body.category || "");
  const location = String(body.location || "").trim();
  const image = String(body.image || "").trim();
  const overview = String(body.overview || "").trim();
  const hourlyRate = Number(body.hourlyRate);
  const securityDeposit = Number(body.securityDeposit);
  const maxCapacity = Number(body.maxCapacity);

  if (title.length < 3 || title.length > 80)
    return { error: "Title must be between 3 and 80 characters." };
  if (!CATEGORIES.includes(category))
    return { error: "Please choose a valid category." };
  if (!Number.isFinite(hourlyRate) || hourlyRate <= 0 || hourlyRate > 10000)
    return { error: "Hourly rate must be a number greater than 0." };
  if (
    !Number.isFinite(securityDeposit) ||
    securityDeposit < 0 ||
    securityDeposit > 100000
  )
    return { error: "Security deposit must be 0 or more." };
  if (!Number.isInteger(maxCapacity) || maxCapacity < 1 || maxCapacity > 1000)
    return { error: "Max capacity must be a whole number of at least 1." };
  if (location.length < 5 || location.length > 150)
    return { error: "Please enter the full location or address." };
  if (!image || !isImage(image))
    return { error: "Please provide a valid main image URL." };
  if (overview.length < 20 || overview.length > 2000)
    return { error: "The overview must be between 20 and 2000 characters." };

  const amenities = (Array.isArray(body.amenities) ? body.amenities : [])
    .map((item) => String(item).trim())
    .filter(Boolean);
  if (amenities.length < 1 || amenities.length > 20)
    return { error: "Please add between 1 and 20 amenities." };
  if (amenities.some((item) => item.length > 40))
    return { error: "Each amenity must be 40 characters or fewer." };

  const gallery = (Array.isArray(body.gallery) ? body.gallery : [])
    .map((item) => String(item).trim())
    .filter(Boolean);
  if (gallery.length > 6)
    return { error: "You can add up to 6 extra gallery images." };
  if (gallery.some((item) => !isImage(item)))
    return { error: "One of the gallery image URLs is not valid." };

  return {
    data: {
      title,
      category,
      hourlyRate,
      securityDeposit,
      maxCapacity,
      location,
      image,
      gallery,
      amenities,
      overview,
    },
  };
}

// Never send reviewers' email addresses to the browser
function toPublicStudio(studio) {
  return {
    ...studio,
    reviews: (studio.reviews || []).map(({ userEmail, ...review }) => review),
  };
}

// ---------- public routes ----------

// GET /studios?search=&category=&sort=&minPrice=&maxPrice=
router.get("/studios", async (req, res) => {
  const { studios } = await getCollections();
  const { search, category, sort, minPrice, maxPrice } = req.query;

  const filter = {};

  if (category && CATEGORIES.includes(category)) {
    filter.category = category;
  }

  if (search && String(search).trim()) {
    const pattern = new RegExp(escapeRegex(String(search).trim()), "i");
    filter.$or = [{ title: pattern }, { location: pattern }, { category: pattern }];
  }

  const price = {};
  if (minPrice !== undefined && Number.isFinite(Number(minPrice)))
    price.$gte = Number(minPrice);
  if (maxPrice !== undefined && Number.isFinite(Number(maxPrice)))
    price.$lte = Number(maxPrice);
  if (Object.keys(price).length) filter.hourlyRate = price;

  const sorts = {
    newest: { createdAt: -1 },
    "price-low": { hourlyRate: 1 },
    "price-high": { hourlyRate: -1 },
    rating: { rating: -1, reviewCount: -1 },
  };

  const result = await studios
    .find(filter)
    .sort(sorts[sort] || sorts.newest)
    .project({ reviews: 0 })
    .toArray();

  res.json(result);
});

// GET /studios/featured -> the 6 best rated (newest first when tied)
router.get("/studios/featured", async (req, res) => {
  const { studios } = await getCollections();
  const result = await studios
    .find()
    .sort({ rating: -1, createdAt: -1 })
    .limit(6)
    .project({ reviews: 0 })
    .toArray();
  res.json(result);
});

// GET /studios/:id
router.get("/studios/:id", async (req, res) => {
  const _id = toObjectId(req.params.id);
  if (!_id) return res.status(404).json({ message: "Studio not found." });

  const { studios } = await getCollections();
  const studio = await studios.findOne({ _id });
  if (!studio) return res.status(404).json({ message: "Studio not found." });

  res.json(toPublicStudio(studio));
});

// ---------- private routes (need a valid token) ----------

// GET /my-studios -> only the studios owned by the logged-in user
router.get("/my-studios", verifyToken, async (req, res) => {
  const { studios } = await getCollections();
  const result = await studios
    .find({ ownerEmail: req.user.email })
    .sort({ createdAt: -1 })
    .project({ reviews: 0 })
    .toArray();
  res.json(result);
});

// POST /studios -> owner details come from the token, not from the form
router.post("/studios", verifyToken, async (req, res) => {
  const { data, error } = validateStudio(req.body);
  if (error) return res.status(400).json({ message: error });

  const { studios } = await getCollections();
  const studio = {
    ...data,
    ownerEmail: req.user.email,
    ownerName: req.user.name,
    ownerImage: req.user.image,
    rating: 0,
    reviewCount: 0,
    reviews: [],
    createdAt: new Date(),
  };

  const result = await studios.insertOne(studio);
  res.status(201).json({
    message: "Studio added successfully.",
    insertedId: result.insertedId,
  });
});

// PATCH /studios/:id -> only the owner can change a studio
router.patch("/studios/:id", verifyToken, async (req, res) => {
  const _id = toObjectId(req.params.id);
  if (!_id) return res.status(404).json({ message: "Studio not found." });

  const { studios } = await getCollections();
  const studio = await studios.findOne({ _id });
  if (!studio) return res.status(404).json({ message: "Studio not found." });

  if (studio.ownerEmail !== req.user.email) {
    return res
      .status(403)
      .json({ message: "You can only edit your own studios." });
  }

  const { data, error } = validateStudio(req.body);
  if (error) return res.status(400).json({ message: error });

  await studios.updateOne({ _id }, { $set: { ...data, updatedAt: new Date() } });
  res.json({ message: "Studio updated successfully." });
});

// DELETE /studios/:id -> only the owner can delete a studio
router.delete("/studios/:id", verifyToken, async (req, res) => {
  const _id = toObjectId(req.params.id);
  if (!_id) return res.status(404).json({ message: "Studio not found." });

  const { studios, bookings, wishlist } = await getCollections();
  const studio = await studios.findOne({ _id });
  if (!studio) return res.status(404).json({ message: "Studio not found." });

  if (studio.ownerEmail !== req.user.email) {
    return res
      .status(403)
      .json({ message: "You can only delete your own studios." });
  }

  await studios.deleteOne({ _id });

  // Clean up: open bookings are cancelled and saved hearts are removed
  await bookings.updateMany(
    { studioId: _id, status: { $in: ["Pending", "Confirmed"] } },
    { $set: { status: "Cancelled", cancelReason: "The studio was removed by the host." } },
  );
  await wishlist.deleteMany({ studioId: _id });

  res.json({ message: "Studio deleted successfully." });
});

// POST /studios/:id/reviews -> one review per user, owners cannot review themselves
router.post("/studios/:id/reviews", verifyToken, async (req, res) => {
  const _id = toObjectId(req.params.id);
  if (!_id) return res.status(404).json({ message: "Studio not found." });

  const rating = Number(req.body.rating);
  const comment = String(req.body.comment || "").trim();

  if (!Number.isInteger(rating) || rating < 1 || rating > 5)
    return res.status(400).json({ message: "Please choose a rating from 1 to 5." });
  if (comment.length < 5 || comment.length > 500)
    return res
      .status(400)
      .json({ message: "Your review must be between 5 and 500 characters." });

  const { studios } = await getCollections();
  const studio = await studios.findOne({ _id });
  if (!studio) return res.status(404).json({ message: "Studio not found." });

  if (studio.ownerEmail === req.user.email)
    return res.status(400).json({ message: "You can't review your own studio." });

  if ((studio.reviews || []).some((review) => review.userEmail === req.user.email))
    return res
      .status(409)
      .json({ message: "You have already reviewed this studio." });

  const review = {
    userEmail: req.user.email,
    name: req.user.name,
    image: req.user.image,
    rating,
    comment,
    createdAt: new Date(),
  };

  const allReviews = [...(studio.reviews || []), review];
  const average =
    allReviews.reduce((sum, item) => sum + item.rating, 0) / allReviews.length;

  await studios.updateOne(
    { _id },
    {
      $push: { reviews: review },
      $set: {
        rating: Math.round(average * 10) / 10,
        reviewCount: allReviews.length,
      },
    },
  );

  res.status(201).json({ message: "Thank you for your review!" });
});

export default router;
