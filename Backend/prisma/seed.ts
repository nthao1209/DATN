import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import admin from "firebase-admin";



dotenv.config();
const prisma = new PrismaClient();
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  }),
});

async function ensureFirebaseVerified(uid: string, email: string) {
  try {
    await admin.auth().getUser(uid);
    await admin.auth().updateUser(uid, { email, emailVerified: true });
  } catch (e: any) {
    if (e?.code === "auth/user-not-found") {
      await admin.auth().createUser({
        uid,
        email,
        emailVerified: true,
        displayName: "System Super Admin",
      });
    } else {
      throw e;
    }
  }
}

async function ensureRoles() {
  const systemSuperAdmin = await prisma.role.upsert({
    where: { id: 1 },
    update: { name: "System Super Admin", description: "Global system administrator" },
    create: { id: 1, name: "System Super Admin", description: "Global system administrator" },
  });

  const adminRole = await prisma.role.upsert({
    where: { id: 2 },
    update: { name: "Admin", description: "Tenant administrator" },
    create: { id: 2, name: "Admin", description: "Tenant administrator" },
  });

  const busManagementRole = await prisma.role.upsert({
    where: { id: 3 },
    update: { name: "BusManagement", description: "Bus management role" },
    create: { id: 3, name: "BusManagement", description: "Bus management role" },
  });

  return { systemSuperAdmin, adminRole, busManagementRole };
}

async function main() {
  const email = (process.env.SUPERADMIN_EMAIL || "").trim().toLowerCase();
  const firebaseUid = (process.env.SUPERADMIN_UID || "").trim();

  await ensureRoles();

  if (!email || !firebaseUid) {
    return;
  }

  const user = await prisma.user.upsert({
    where: { firebaseUid },
    update: { email, name: "System Super Admin" },
    create: { email, name: "System Super Admin", firebaseUid },
  });

  await prisma.userTenant.deleteMany({
    where: { userId: user.id, tenantId: null },
  });

  await prisma.userTenant.create({
    data: {
      userId: user.id,
      tenantId: null,
      roleId: 1,
    },
  });

  await ensureFirebaseVerified(firebaseUid, email);

}

main()
  .catch((e) => {
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });