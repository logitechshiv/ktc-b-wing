import bcrypt from "bcryptjs";
import User from "@/models/User";

const SUPER_ADMIN = {
  name: "Shiv Sheladiya",
  mobile: "8866225674",
  email: "shiv.sheladiya@gmail.com",
  password: "shivtech#20hs",
  role: "super_admin" as const,
  status: true,
};

let seeding: Promise<void> | null = null;

/** Creates the default Super Admin once — never duplicates. Call after DB is connected. */
export async function ensureSuperAdmin() {
  if (!seeding) {
    seeding = (async () => {
      const existing = await User.findOne({
        $or: [{ email: SUPER_ADMIN.email }, { role: "super_admin" }],
      }).lean();

      if (existing) return;

      const hashed = await bcrypt.hash(SUPER_ADMIN.password, 12);
      await User.create({
        name: SUPER_ADMIN.name,
        email: SUPER_ADMIN.email,
        mobile: SUPER_ADMIN.mobile,
        password: hashed,
        role: SUPER_ADMIN.role,
        status: SUPER_ADMIN.status,
      });
    })().catch((err) => {
      seeding = null;
      throw err;
    });
  }

  await seeding;
}
