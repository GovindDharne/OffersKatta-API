import { PrismaClient } from '@prisma/client';
import { seedPermissions } from './permissions.seed';
import { seedRoles } from './roles.seed';
import { seedCategories } from './categories.seed';
import { seedAdmin } from './admin.seed';
import { seedSampleBusinesses } from './businesses.seed';
import { seedBanks } from './banks.seed';
import { seedMalls } from './malls.seed';

const prisma = new PrismaClient();

async function main() {
  console.log('\n  Seeding OffersKatta database\n');

  console.log('  Seeding permissions...');
  const permissions = await seedPermissions(prisma);
  console.log(`     ${permissions.length} permissions`);

  console.log('  Seeding roles + role-permission matrix...');
  const roles = await seedRoles(prisma, permissions);
  console.log(`     ${roles.length} roles`);

  console.log('  Seeding categories...');
  const categories = await seedCategories(prisma);
  console.log(`     ${categories.length} categories`);

  console.log('  Seeding banks + card types...');
  const bankSummary = await seedBanks(prisma);
  console.log(`     ${bankSummary.banks} banks, ${bankSummary.cards} card types`);

  console.log('  Seeding sample malls...');
  const malls = await seedMalls(prisma);
  console.log(`     ${malls.length} malls`);

  console.log('  Seeding super admin...');
  const admin = await seedAdmin(prisma, roles);
  console.log(`     ${admin.email}`);

  if (process.env.SEED_SAMPLE_DATA !== 'false') {
    console.log('  Seeding sample brands + branches + managers + offers...');
    const summary = await seedSampleBusinesses(prisma, categories, roles);
    console.log(
      `     ${summary.brands} brands, ${summary.branches} branches, ` +
        `${summary.managers} managers, ${summary.offers} offers, ` +
        `${summary.customers} customers`,
    );
  }

  console.log('\n  Seed complete.\n');
}

main()
  .catch(async (err) => {
    console.error('\nSeed failed:', err);
    await prisma.$disconnect();
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
