const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const email = 'nthao4744@gmail.com'.toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      userTenants: {
        include: {
          tenant: true,
          role: true,
        },
      },
    },
  });

  const result = {
    email,
    found: !!user,
    user: user
      ? {
          id: user.id,
          firebaseUid: user.firebaseUid,
          name: user.name,
          isDisabled: user.isDisabled,
        }
      : null,
    userTenants: (user?.userTenants || []).map((ut) => ({
      id: ut.id,
      tenantId: ut.tenantId,
      tenantName: ut.tenant ? ut.tenant.name : null,
      roleId: ut.roleId,
      roleName: ut.role ? ut.role.name : null,
    })),
  };

  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
