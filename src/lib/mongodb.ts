import mongoose from "mongoose";
import { ensureSuperAdmin } from "@/lib/ensure-super-admin";
import { ensureFlatsSeed, migrateNamesToGujaratiOnly } from "@/lib/ensure-flats";

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  // eslint-disable-next-line no-var
  var mongooseCache: MongooseCache | undefined;
}

const cached: MongooseCache = global.mongooseCache ?? { conn: null, promise: null };
global.mongooseCache = cached;

function getMongoUri() {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    throw new Error("Missing MONGODB_URI in environment variables");
  }
  return uri;
}

let indexSync: Promise<void> | null = null;

async function ensureIndexes() {
  if (!indexSync) {
    indexSync = (async () => {
      const Flat = (await import("@/models/Flat")).default;
      const Payment = (await import("@/models/Payment")).default;
      const BuilderPayment = (await import("@/models/BuilderPayment")).default;
      await Promise.all([
        Flat.syncIndexes(),
        Payment.syncIndexes(),
        BuilderPayment.syncIndexes(),
      ]);
    })().catch((err) => {
      indexSync = null;
      console.warn("Index sync skipped:", err instanceof Error ? err.message : err);
    });
  }
  await indexSync;
}

async function runSeeds() {
  await ensureSuperAdmin();
  await ensureFlatsSeed();
  await migrateNamesToGujaratiOnly();
  await ensureIndexes();
}

/** Reusable MongoDB connection — reuses the cached connection across hot reloads & requests. */
export async function connectDB() {
  if (cached.conn) {
    await runSeeds();
    return cached.conn;
  }

  const uri = getMongoUri();

  if (!cached.promise) {
    cached.promise = mongoose.connect(uri, {
      bufferCommands: false,
      serverSelectionTimeoutMS: 10000,
      family: 4,
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (error) {
    cached.promise = null;
    throw error;
  }

  await runSeeds();
  return cached.conn;
}

export default connectDB;
