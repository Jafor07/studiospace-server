import { Router } from "express";
import { getCollections } from "../lib/db.js";
import { verifyToken } from "../middleware/verifyToken.js";
import { minutesToTime, timeToMinutes, toObjectId } from "../lib/helpers.js";

const router = Router();

const TIME_PATTERN = /^([01]\d|2[0-3]):(00|30)$/; // half-hour slots only
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// CHALLENGE 2: look for a CONFIRMED booking that overlaps the requested time.
// Two time ranges overlap when each one starts before the other one ends.
// (A booking that ends at 14:00 does not clash with one that starts at 14:00.)
function findClash(bookings, { studioId, date, startMin, endMin, excludeId }) {
  const filter = {
    studioId,
    date,
    status: "Confirmed",
    startMin: { $lt: endMin },
    endMin: { $gt: startMin },
  };
  if (excludeId) filter._id = { $ne: excludeId };
  return bookings.findOne(filter);
}

const clashMessage = (clash) =>
  `This studio is already booked from ${clash.startTime} to ${clash.endTime} on ${clash.date}. Please pick a different time.`;

// POST /bookings -> a guest asks to book a studio (status starts as Pending)
router.post("/bookings", verifyToken, async (req, res) => {
  const { studioId, date, startTime, notes } = req.body;
  const hours = Number(req.body.hours);

  const studioObjectId = toObjectId(String(studioId || ""));
  if (!studioObjectId)
    return res.status(400).json({ message: "Invalid studio." });
  if (!DATE_PATTERN.test(String(date || "")))
    return res.status(400).json({ message: "Please choose a valid date." });
  if (!TIME_PATTERN.test(String(startTime || "")))
    return res.status(400).json({ message: "Please choose a valid start time." });
  if (!Number.isInteger(hours) || hours < 1 || hours > 12)
    return res
      .status(400)
      .json({ message: "You can book between 1 and 12 hours." });

  // Not in the past. One day of slack covers time zones far from the server.
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  if (date < yesterday)
    return res.status(400).json({ message: "You can't book a date in the past." });

  const startMin = timeToMinutes(startTime);
  const endMin = startMin + hours * 60;
  if (endMin > 24 * 60)
    return res
      .status(400)
      .json({ message: "The booking must end by midnight." });

  const { studios, bookings } = await getCollections();
  const studio = await studios.findOne({ _id: studioObjectId });
  if (!studio) return res.status(404).json({ message: "Studio not found." });

  if (studio.ownerEmail === req.user.email)
    return res.status(400).json({ message: "You can't book your own studio." });

  const clash = await findClash(bookings, {
    studioId: studio._id,
    date,
    startMin,
    endMin,
  });
  if (clash) return res.status(409).json({ message: clashMessage(clash) });

  // The same guest should not send two overlapping requests for one studio
  const duplicate = await bookings.findOne({
    studioId: studio._id,
    date,
    userEmail: req.user.email,
    status: { $in: ["Pending", "Confirmed"] },
    startMin: { $lt: endMin },
    endMin: { $gt: startMin },
  });
  if (duplicate)
    return res.status(409).json({
      message: "You already have a booking request for this studio at that time.",
    });

  const subtotal = hours * studio.hourlyRate;
  const booking = {
    studioId: studio._id,
    studioTitle: studio.title,
    studioImage: studio.image,
    studioLocation: studio.location,
    studioCategory: studio.category,
    hourlyRate: studio.hourlyRate,
    securityDeposit: studio.securityDeposit,
    hostEmail: studio.ownerEmail,
    hostName: studio.ownerName,
    userEmail: req.user.email,
    userName: req.user.name,
    userImage: req.user.image,
    date,
    startTime,
    endTime: minutesToTime(endMin),
    startMin,
    endMin,
    hours,
    subtotal,
    total: subtotal + studio.securityDeposit,
    notes: String(notes || "").trim().slice(0, 500),
    status: "Pending",
    createdAt: new Date(),
  };

  const result = await bookings.insertOne(booking);
  res.status(201).json({
    message: "Booking request sent! The host will confirm it soon.",
    insertedId: result.insertedId,
  });
});

// GET /my-bookings -> the guest's own bookings (email comes from the token)
router.get("/my-bookings", verifyToken, async (req, res) => {
  const { bookings } = await getCollections();
  const result = await bookings
    .find({ userEmail: req.user.email })
    .sort({ createdAt: -1 })
    .toArray();
  res.json(result);
});

// PATCH /bookings/:id/cancel -> a guest cancels their own PENDING booking
router.patch("/bookings/:id/cancel", verifyToken, async (req, res) => {
  const _id = toObjectId(req.params.id);
  if (!_id) return res.status(404).json({ message: "Booking not found." });

  const { bookings } = await getCollections();
  const booking = await bookings.findOne({ _id });
  if (!booking) return res.status(404).json({ message: "Booking not found." });

  if (booking.userEmail !== req.user.email)
    return res
      .status(403)
      .json({ message: "You can only cancel your own bookings." });

  if (booking.status !== "Pending")
    return res
      .status(400)
      .json({ message: "Only pending bookings can be cancelled." });

  await bookings.updateOne(
    { _id },
    { $set: { status: "Cancelled", cancelReason: "Cancelled by the guest." } },
  );
  res.json({ message: "Booking cancelled." });
});

// GET /host-bookings -> requests for studios owned by the logged-in host
router.get("/host-bookings", verifyToken, async (req, res) => {
  const { bookings } = await getCollections();
  const result = await bookings
    .find({ hostEmail: req.user.email })
    .sort({ createdAt: -1 })
    .toArray();
  res.json(result);
});

// PATCH /bookings/:id/status -> the HOST confirms, declines or completes a booking
router.patch("/bookings/:id/status", verifyToken, async (req, res) => {
  const _id = toObjectId(req.params.id);
  if (!_id) return res.status(404).json({ message: "Booking not found." });

  const nextStatus = req.body.status;
  if (!["Confirmed", "Cancelled", "Completed"].includes(nextStatus))
    return res.status(400).json({ message: "Invalid status." });

  const { bookings } = await getCollections();
  const booking = await bookings.findOne({ _id });
  if (!booking) return res.status(404).json({ message: "Booking not found." });

  if (booking.hostEmail !== req.user.email)
    return res
      .status(403)
      .json({ message: "Only the studio host can change this booking." });

  const allowed = {
    Confirmed: ["Pending"],
    Completed: ["Confirmed"],
    Cancelled: ["Pending", "Confirmed"],
  };
  if (!allowed[nextStatus].includes(booking.status))
    return res.status(400).json({
      message: `A ${booking.status.toLowerCase()} booking can't be changed to ${nextStatus.toLowerCase()}.`,
    });

  // Confirming takes the slot, so check again that nobody else got it first
  if (nextStatus === "Confirmed") {
    const clash = await findClash(bookings, {
      studioId: booking.studioId,
      date: booking.date,
      startMin: booking.startMin,
      endMin: booking.endMin,
      excludeId: _id,
    });
    if (clash) return res.status(409).json({ message: clashMessage(clash) });
  }

  const changes = { status: nextStatus };
  if (nextStatus === "Cancelled")
    changes.cancelReason = "Declined by the host.";

  await bookings.updateOne({ _id }, { $set: changes });
  res.json({ message: `Booking marked as ${nextStatus.toLowerCase()}.` });
});

export default router;
