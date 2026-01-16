const {PrismaClient} = require('./apps/api/node_modules/@prisma/client');
(async () => {
  const prisma = new PrismaClient();
  console.log('room delegate', typeof prisma.room);
  await prisma.$disconnect();
})();
