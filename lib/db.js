import "dotenv/config";
import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;

if (!uri) {
  throw new Error("MONGODB_URI is missing. Add it to your .env file.");
}

const client = new MongoClient(uri);
let dbPromise;

// Connect only once and reuse the same connection for every request.
// This matters on Vercel, where the same server instance handles many requests.
export function getDb() {
  if (!dbPromise) {
    dbPromise = client
      .connect()
      .then(async () => {
        console.log("You successfully connected to MongoDB!");
        const db = client.db(process.env.DB_NAME || "studiospace");

        // Indexes make the most common searches fast and stop duplicate wishlist rows
        await db
          .collection("bookings")
          .createIndex({ studioId: 1, date: 1, status: 1 });
        await db.collection("bookings").createIndex({ userEmail: 1 });
        await db.collection("bookings").createIndex({ hostEmail: 1 });
        await db
          .collection("wishlist")
          .createIndex({ userEmail: 1, studioId: 1 }, { unique: true });

        return db;
      })
      .catch((error) => {
        dbPromise = undefined; // try again on the next request
        throw error;
      });
  }
  return dbPromise;
}

export async function getCollections() {
  const db = await getDb();
  return {
    studios: db.collection("studios"),
    bookings: db.collection("bookings"),
    wishlist: db.collection("wishlist"),
  };
}
