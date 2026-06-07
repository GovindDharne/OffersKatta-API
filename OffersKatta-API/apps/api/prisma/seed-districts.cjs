/* One-off: load every Indian district into the City master (name=district,
 * state=state). Idempotent — createMany({ skipDuplicates }) skips any (name,
 * state) pair that already exists, so it won't clash with the cities already
 * seeded from branches/malls. Run:
 *   docker exec -w /repo/apps/api offerhub-api node prisma/seed-districts.cjs
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Align legacy/variant state names in the dataset with our State master.
const STATE_NORMALIZE = {
  Orissa: 'Odisha',
  Pondicherry: 'Puducherry',
  'NCT of Delhi': 'Delhi',
  'Andaman and Nicobar': 'Andaman and Nicobar Islands',
  'Dadra and Nagar Haveli': 'Dadra and Nagar Haveli and Daman and Diu',
  'Daman and Diu': 'Dadra and Nagar Haveli and Daman and Diu',
  'Jammu & Kashmir': 'Jammu and Kashmir',
};

const URL =
  'https://raw.githubusercontent.com/sab99r/Indian-States-And-Districts/master/states-and-districts.json';

(async () => {
  const res = await fetch(URL);
  if (!res.ok) throw new Error(`dataset HTTP ${res.status}`);
  const json = await res.json();
  const states = json.states || [];

  const seen = new Set();
  const data = [];
  for (const s of states) {
    const state = (STATE_NORMALIZE[s.state] || s.state || '').trim();
    if (!state) continue;
    for (const d of s.districts || []) {
      const name = String(d).trim();
      if (!name) continue;
      const key = `${name}|${state}`.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      data.push({ name, state, country: 'India', isActive: true });
    }
  }

  const before = await prisma.city.count();
  const result = await prisma.city.createMany({ data, skipDuplicates: true });
  const after = await prisma.city.count();
  console.log(
    JSON.stringify({
      datasetStates: states.length,
      uniqueDistricts: data.length,
      inserted: result.count,
      citiesBefore: before,
      citiesAfter: after,
    }),
  );
  await prisma.$disconnect();
})().catch((e) => {
  console.error('ERR', e.message);
  process.exit(1);
});
