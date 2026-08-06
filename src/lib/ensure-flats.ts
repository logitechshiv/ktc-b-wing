import Flat from "@/models/Flat";
import Vehicle from "@/models/Vehicle";

const TOTAL_FLOORS = 13;
const FLATS_PER_FLOOR = 4;

let seeding: Promise<void> | null = null;
let nameMigration: Promise<void> | null = null;

/**
 * Auto-seeds 52 flats (13 floors × 4) when the flats collection is empty.
 * Never inserts duplicates.
 */
export async function ensureFlatsSeed() {
  if (!seeding) {
    seeding = (async () => {
      const count = await Flat.countDocuments();
      if (count > 0) return;

      const docs = [];
      for (let floor = 1; floor <= TOTAL_FLOORS; floor++) {
        for (let unit = 1; unit <= FLATS_PER_FLOOR; unit++) {
          const flatNumber = String(floor * 100 + unit);
          docs.push({
            floorNumber: floor,
            flatNumber,
            ownerName: "",
            ownerMobile: "",
            renterName: "",
            renterMobile: "",
            status: "available" as const,
            notes: "",
          });
        }
      }

      await Flat.insertMany(docs, { ordered: false });
    })().catch((err) => {
      seeding = null;
      throw err;
    });
  }

  await seeding;
}

/**
 * One-time (idempotent): promote legacy *Gujarati fields into ownerName/renterName
 * and drop the dual English/Gujarati name columns from MongoDB documents.
 */
export async function migrateNamesToGujaratiOnly() {
  if (!nameMigration) {
    nameMigration = (async () => {
      await Flat.collection.updateMany(
        {
          $or: [{ ownerNameGujarati: { $exists: true } }, { renterNameGujarati: { $exists: true } }],
        },
        [
          {
            $set: {
              ownerName: {
                $cond: [
                  { $gt: [{ $strLenCP: { $ifNull: ["$ownerNameGujarati", ""] } }, 0] },
                  "$ownerNameGujarati",
                  { $ifNull: ["$ownerName", ""] },
                ],
              },
              renterName: {
                $cond: [
                  { $gt: [{ $strLenCP: { $ifNull: ["$renterNameGujarati", ""] } }, 0] },
                  "$renterNameGujarati",
                  { $ifNull: ["$renterName", ""] },
                ],
              },
            },
          },
          { $unset: ["ownerNameGujarati", "renterNameGujarati"] },
        ]
      );

      await Vehicle.collection.updateMany({ ownerNameGujarati: { $exists: true } }, [
        {
          $set: {
            ownerName: {
              $cond: [
                { $gt: [{ $strLenCP: { $ifNull: ["$ownerNameGujarati", ""] } }, 0] },
                "$ownerNameGujarati",
                { $ifNull: ["$ownerName", ""] },
              ],
            },
          },
        },
        { $unset: ["ownerNameGujarati"] },
      ]);
    })().catch((err) => {
      nameMigration = null;
      throw err;
    });
  }

  await nameMigration;
}
