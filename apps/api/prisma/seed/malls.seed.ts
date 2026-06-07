import type { Mall, PrismaClient } from '@prisma/client';

interface MallSpec {
  name: string;
  slug: string;
  description: string;
  addressLine1: string;
  city: string;
  state: string;
  postalCode: string;
  latitude: number;
  longitude: number;
  phone?: string;
  websiteUrl?: string;
}

const MALLS: MallSpec[] = [
  {
    name: 'Phoenix Marketcity Mumbai',
    slug: 'phoenix-marketcity-mumbai',
    description: 'Premium shopping & lifestyle destination in Kurla',
    addressLine1: 'LBS Marg, Kurla West',
    city: 'Mumbai',
    state: 'Maharashtra',
    postalCode: '400070',
    latitude: 19.0859,
    longitude: 72.8893,
    phone: '+912261803000',
    websiteUrl: 'https://www.phoenixmarketcity.com/mumbai',
  },
  {
    name: 'Inorbit Mall Vashi',
    slug: 'inorbit-mall-vashi',
    description: 'One-stop shopping & entertainment hub in Navi Mumbai',
    addressLine1: 'Plot 39/1, Sector 30A, Vashi',
    city: 'Navi Mumbai',
    state: 'Maharashtra',
    postalCode: '400703',
    latitude: 19.0703,
    longitude: 73.0010,
    phone: '+912267393900',
    websiteUrl: 'https://www.inorbit.in',
  },
  {
    name: 'Phoenix Marketcity Pune',
    slug: 'phoenix-marketcity-pune',
    description: 'Largest mall in Pune with 300+ brands',
    addressLine1: 'Nagar Road, Viman Nagar',
    city: 'Pune',
    state: 'Maharashtra',
    postalCode: '411014',
    latitude: 18.5621,
    longitude: 73.9163,
    websiteUrl: 'https://www.phoenixmarketcity.com/pune',
  },
];

export async function seedMalls(prisma: PrismaClient): Promise<Mall[]> {
  const out: Mall[] = [];
  for (const spec of MALLS) {
    const mall = await prisma.mall.upsert({
      where: { slug: spec.slug },
      create: { ...spec, country: 'India' },
      update: { ...spec, country: 'India' },
    });
    out.push(mall);
  }
  return out;
}
