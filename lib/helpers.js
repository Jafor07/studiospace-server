import { ObjectId } from "mongodb";

// Must match the categories used by the client
export const CATEGORIES = [
  "Photo Studio",
  "Film Stage",
  "Podcast Lounge",
  "Music Suite",
  "Workshop",
];

// Turns a string into an ObjectId, or returns null if it is not a real id.
// (ObjectId.isValid alone accepts any 12-letter text, so we compare the result.)
export function toObjectId(value) {
  if (typeof value !== "string" || !ObjectId.isValid(value)) return null;
  const objectId = new ObjectId(value);
  return objectId.toString() === value ? objectId : null;
}

export function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// "14:30" -> 870
export function timeToMinutes(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

// 870 -> "14:30"
export function minutesToTime(totalMinutes) {
  const hours = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
  const minutes = String(totalMinutes % 60).padStart(2, "0");
  return `${hours}:${minutes}`;
}
