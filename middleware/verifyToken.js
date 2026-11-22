import { createRemoteJWKSet, jwtVerify } from "jose";

// The client (Next.js + BetterAuth) publishes its public keys at /api/auth/jwks.
// We create the key set only once, so it is not downloaded on every request.
let jwks;

function getJwks() {
  if (!process.env.CLIENT_URL) {
    throw new Error("CLIENT_URL is missing. Add it to your .env file.");
  }
  if (!jwks) {
    // Remove spaces and any "/" at the end, so a typo can't break the address
    const clientUrl = process.env.CLIENT_URL.trim().replace(/\/+$/, "");
    jwks = createRemoteJWKSet(new URL(`${clientUrl}/api/auth/jwks`));
  }
  return jwks;
}

// Put this in front of any route that needs a logged-in user.
// It answers 401 Unauthorized when the token is missing, fake or expired.
export async function verifyToken(req, res, next) {
  const [scheme, token] = (req.headers.authorization || "").split(" ");

  if (scheme !== "Bearer" || !token) {
    return res
      .status(401)
      .json({ message: "Unauthorized. Please log in to continue." });
  }

  try {
    const { payload } = await jwtVerify(token, getJwks());

    if (!payload.email) {
      return res.status(401).json({ message: "Unauthorized. Invalid token." });
    }

    // From here on, routes read the user from req.user.
    // They never trust an email that comes from the request body.
    req.user = {
      id: payload.id || payload.sub,
      email: payload.email,
      name: payload.name || "StudioSpace User",
      image: payload.image || "",
    };
    next();
  } catch (error) {
    console.error("Token check failed:", error.message);
    return res.status(401).json({
      message: "Your session is invalid or has expired. Please log in again.",
    });
  }
}
