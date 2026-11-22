import { getCollections, getDb } from "./lib/db.js";

// Fills your database with 8 sample studios so the site looks alive.
//
//   npm run seed                                   -> studios owned by host@studiospace.com
//   node seed.js you@example.com "Your Name"       -> studios owned by YOU, so they
//                                                    show up in My Studio Listings
// Run it again any time: it replaces the old sample studios, not your own ones.

const ownerEmail = process.argv[2] || process.env.SEED_OWNER_EMAIL || "host@studiospace.com";
const ownerName = process.argv[3] || process.env.SEED_OWNER_NAME || "StudioSpace Host";

// Free photos from Pexels (free to use, no attribution required).
// If one ever stops loading, the site shows its built-in illustration instead.
const photo = (id, width = 1400) =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${width}`;

const hostAvatar = "/avatars/studio-host.svg";

const studios = [
  {
    title: "Lumen Cyc Wall Studio",
    category: "Photo Studio",
    hourlyRate: 45,
    securityDeposit: 120,
    maxCapacity: 12,
    location: "House 24, Road 11, Banani, Dhaka 1213",
    image: photo(134469),
    gallery: [photo(7383646), photo(2388569)],
    amenities: ["Wi-Fi", "Air conditioning", "Backdrops and paper", "Softboxes and strobes", "Makeup station", "Power backup", "Parking"],
    overview:
      "A 900 square foot white cyclorama wall with a seamless floor curve, built for fashion, product and portrait work. Two softboxes, a beauty dish and a full set of paper backdrops are included in the hourly rate. The makeup station has mirrors and good lighting, and the street entrance makes loading gear easy.",
    reviews: [
      { name: "Nusrat Jahan", rating: 5, comment: "The cyc wall was spotless and the lights were already set up. We finished our lookbook shoot an hour early.", days: 18 },
      { name: "Tanvir Ahmed", rating: 5, comment: "Great space for product photography. The host answered every question before we arrived.", days: 41 },
      { name: "Farhana Rahman", rating: 4, comment: "Lovely studio and easy parking. The air conditioning takes a while to cool the room in summer.", days: 63 },
    ],
  },
  {
    title: "Northlight Daylight Loft",
    category: "Photo Studio",
    hourlyRate: 35,
    securityDeposit: 80,
    maxCapacity: 8,
    location: "Level 5, 17 Mirpur Road, Dhanmondi, Dhaka 1205",
    image: photo(4268512),
    gallery: [photo(4123848), photo(7383644)],
    amenities: ["Wi-Fi", "Air conditioning", "Props and furniture", "Changing room", "Restroom", "Kitchenette"],
    overview:
      "A bright top-floor loft with tall north-facing windows and soft, even daylight from morning until late afternoon. Exposed brick, vintage furniture and a small prop library make it a favourite for lifestyle shoots, family portraits and editorial work.",
    reviews: [
      { name: "Sadia Islam", rating: 5, comment: "The natural light is unreal. Our whole portrait series looked warm without any extra lighting.", days: 9 },
      { name: "Rakib Hasan", rating: 4, comment: "Cosy space with plenty of props. Level 5 has no lift, so pack light.", days: 35 },
    ],
  },
  {
    title: "Stage One Soundstage",
    category: "Film Stage",
    hourlyRate: 120,
    securityDeposit: 400,
    maxCapacity: 40,
    location: "Plot 8, Tejgaon Industrial Area, Dhaka 1208",
    image: photo(2608519),
    gallery: [photo(3935026), photo(6621416)],
    amenities: ["Power backup", "Air conditioning", "Blackout curtains", "Soundproofing", "Green room", "Parking", "Restroom", "Wi-Fi"],
    overview:
      "A 2,400 square foot soundproofed stage with a lighting grid, three-phase power and a drive-in loading door. The attached green room fits ten people, and the blackout walls let you shoot day for night without worrying about outside noise. A good fit for commercials, short films and music videos.",
    reviews: [
      { name: "Imran Chowdhury", rating: 5, comment: "We shot a two-day commercial here. Power never dropped and the crew parking was a huge help.", days: 22 },
      { name: "Maliha Karim", rating: 5, comment: "The soundproofing is the real deal. Clean dialogue recordings on set with no traffic noise.", days: 52 },
      { name: "Shafiq Alam", rating: 4, comment: "Big, professional stage. Book early because weekends fill up fast.", days: 80 },
    ],
  },
  {
    title: "Harbor Light Film Stage",
    category: "Film Stage",
    hourlyRate: 95,
    securityDeposit: 300,
    maxCapacity: 30,
    location: "Agrabad Commercial Area, Chattogram 4100",
    image: photo(7513459),
    gallery: [photo(3935027), photo(6621403)],
    amenities: ["Power backup", "Air conditioning", "Blackout curtains", "Green room", "Parking", "Wi-Fi"],
    overview:
      "Chattogram’s newest stage, with a painted white floor, a motorised curtain track and a flexible lighting rail. It suits narrative shorts, interviews and live-streamed events, and the host can arrange extra lighting gear on request.",
    reviews: [
      { name: "Arif Hossain", rating: 5, comment: "Perfect for our documentary interviews. Quiet, cool and simple to set up.", days: 14 },
      { name: "Lamia Sultana", rating: 4, comment: "Spacious and well run. The lighting rail saved us a lot of rigging time.", days: 47 },
    ],
  },
  {
    title: "Echo Room Podcast Lounge",
    category: "Podcast Lounge",
    hourlyRate: 28,
    securityDeposit: 60,
    maxCapacity: 5,
    location: "Road 103, Gulshan 2, Dhaka 1212",
    image: photo(270288),
    gallery: [photo(3710191), photo(7450049)],
    amenities: ["Microphones included", "Soundproofing", "Air conditioning", "Wi-Fi", "Props and furniture"],
    overview:
      "A treated lounge for up to four guests, with four broadcast dynamic microphones, boom arms and a headphone amp for every seat. The room has acoustic panels on every wall and a comfortable sofa for long conversations. Bring a laptop or use the studio’s recording interface.",
    reviews: [
      { name: "Rubaiyat Kabir", rating: 5, comment: "Our audio sounded professional from the first minute. The mics and the room treatment are excellent.", days: 6 },
      { name: "Anika Tabassum", rating: 5, comment: "Comfortable for long episodes and easy to get to. The host helped us with the levels.", days: 28 },
      { name: "Zubair Khan", rating: 5, comment: "Best podcast room we have used in Dhaka. We booked the same slot for the whole season.", days: 55 },
    ],
  },
  {
    title: "The Quiet Mic",
    category: "Podcast Lounge",
    hourlyRate: 22,
    securityDeposit: 40,
    maxCapacity: 4,
    location: "Zindabazar, Sylhet 3100",
    image: photo(164755),
    gallery: [photo(2097428), photo(2918997)],
    amenities: ["Microphones included", "Soundproofing", "Wi-Fi", "Air conditioning"],
    overview:
      "A small, quiet room in the middle of Sylhet, ideal for solo shows, interviews and voice-over work. It comes with two microphones, a pop filter and a simple recording setup, so you can arrive with nothing but your ideas.",
    reviews: [
      { name: "Mehedi Hasan", rating: 4, comment: "Quiet, tidy and good value. A good place for voice-over sessions.", days: 20 },
      { name: "Sumaiya Akter", rating: 5, comment: "The host was friendly and the room is very well insulated.", days: 44 },
    ],
  },
  {
    title: "Redwave Recording Suite",
    category: "Music Suite",
    hourlyRate: 55,
    securityDeposit: 150,
    maxCapacity: 10,
    location: "Sector 7, Uttara, Dhaka 1230",
    image: photo(5650547),
    gallery: [photo(7087606), photo(5657665)],
    amenities: ["Mixing console", "Microphones included", "Soundproofing", "Air conditioning", "Wi-Fi", "Power backup", "Green room"],
    overview:
      "A control room and a separate live room, connected by a glass window. The suite has a 16-channel mixing console, studio monitors, a vocal booth and a selection of condenser and dynamic microphones. An in-house engineer is available for an extra fee.",
    reviews: [
      { name: "Sajid Rahman", rating: 5, comment: "We tracked a full EP here. The monitors are honest and the live room sounds great.", days: 11 },
      { name: "Tasnia Ferdous", rating: 5, comment: "Vocals came out so clean. The booth is comfortable for long takes.", days: 38 },
      { name: "Nayeem Uddin", rating: 4, comment: "Great gear and a professional setup. Allow some time to settle the room before tracking drums.", days: 71 },
    ],
  },
  {
    title: "Palette & Clay Art Workshop",
    category: "Workshop",
    hourlyRate: 18,
    securityDeposit: 50,
    maxCapacity: 16,
    location: "Mirpur DOHS, Dhaka 1216",
    image: photo(2900935),
    gallery: [photo(8191551), photo(3777935)],
    amenities: ["Wi-Fi", "Air conditioning", "Props and furniture", "Kitchenette", "Restroom", "Parking"],
    overview:
      "A bright, easy-to-clean room with long work tables, twelve easels, a pottery wheel and a kiln the host can fire for you. It is popular for painting classes, ceramics evenings and small exhibitions, and the wall space is ready to hang finished pieces.",
    reviews: [
      { name: "Nabila Haque", rating: 5, comment: "We ran a weekend painting class here. Everyone had enough room and the light was lovely.", days: 16 },
      { name: "Shohag Mia", rating: 4, comment: "Very clean and affordable. The kiln firing was a great extra.", days: 49 },
    ],
  },
];

const daysAgo = (days) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

async function seed() {
  const { studios: studiosCollection, bookings, wishlist } = await getCollections();

  // Remove the old sample studios (and anything tied to them) first
  const old = await studiosCollection.find({ isSeed: true }).project({ _id: 1 }).toArray();
  const oldIds = old.map((studio) => studio._id);
  if (oldIds.length) {
    await studiosCollection.deleteMany({ _id: { $in: oldIds } });
    await bookings.deleteMany({ studioId: { $in: oldIds } });
    await wishlist.deleteMany({ studioId: { $in: oldIds } });
  }

  const documents = studios.map(({ reviews, ...studio }, index) => {
    const builtReviews = reviews.map((review, number) => ({
      userEmail: `reviewer-${index}-${number}@example.com`,
      name: review.name,
      image: "",
      rating: review.rating,
      comment: review.comment,
      createdAt: daysAgo(review.days),
    }));
    const average = builtReviews.reduce((sum, review) => sum + review.rating, 0) / builtReviews.length;

    return {
      ...studio,
      ownerEmail,
      ownerName,
      ownerImage: hostAvatar,
      rating: Math.round(average * 10) / 10,
      reviewCount: builtReviews.length,
      reviews: builtReviews,
      isSeed: true,
      createdAt: daysAgo(index * 3),
    };
  });

  const result = await studiosCollection.insertMany(documents);
  console.log(`Added ${result.insertedCount} sample studios owned by ${ownerEmail}.`);
}

seed()
  .catch((error) => {
    console.error("Seeding failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    const db = await getDb().catch(() => null);
    await db?.client?.close();
    process.exit();
  });
