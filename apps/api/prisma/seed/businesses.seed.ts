import {
  BrandStatus,
  BranchStatus,
  BusinessType,
  OfferStatus,
  OfferType,
  SubscriptionPlan,
  SubscriptionStatus,
  UserRole,
  type Category,
  type PrismaClient,
  type Role,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';

export interface SeedSummary {
  brands: number;
  branches: number;
  managers: number;
  offers: number;
  customers: number;
}

interface BrandSpec {
  name: string;
  slug: string;
  businessType: BusinessType;
  description: string;
  ownerEmail: string;
  ownerName: string;
  categorySlugs: string[];
  branches: Array<{
    name: string;
    slug: string;
    city: string;
    state: string;
    addressLine1: string;
    postalCode: string;
    latitude: number;
    longitude: number;
    phone: string;
    managerEmail: string;
    managerName: string;
  }>;
  offers: Array<{
    title: string;
    slug: string;
    description: string;
    offerType: OfferType;
    discountValue: number;
    daysValid: number;
    isFeatured?: boolean;
  }>;
}

const BRANDS: BrandSpec[] = [
  {
    name: 'ABC Restaurant',
    slug: 'abc-restaurant',
    businessType: BusinessType.RESTAURANT,
    description: 'Authentic multi-cuisine restaurant chain across Maharashtra',
    ownerEmail: 'owner@abc-restaurant.local',
    ownerName: 'Aarav Patel',
    categorySlugs: ['food-drink'],
    branches: [
      {
        name: 'ABC Restaurant — Mumbai',
        slug: 'mumbai',
        city: 'Mumbai',
        state: 'Maharashtra',
        addressLine1: 'Marine Drive, Nariman Point',
        postalCode: '400021',
        latitude: 18.9388,
        longitude: 72.8235,
        phone: '+912222001111',
        managerEmail: 'manager.mumbai@abc-restaurant.local',
        managerName: 'Riya Shah',
      },
      {
        name: 'ABC Restaurant — Pune',
        slug: 'pune',
        city: 'Pune',
        state: 'Maharashtra',
        addressLine1: 'Koregaon Park, Lane 5',
        postalCode: '411001',
        latitude: 18.5362,
        longitude: 73.8939,
        phone: '+912024440000',
        managerEmail: 'manager.pune@abc-restaurant.local',
        managerName: 'Vikram Joshi',
      },
      {
        name: 'ABC Restaurant — Navi Mumbai',
        slug: 'navi-mumbai',
        city: 'Navi Mumbai',
        state: 'Maharashtra',
        addressLine1: 'Palm Beach Road, Vashi',
        postalCode: '400703',
        latitude: 19.0760,
        longitude: 73.0008,
        phone: '+912227890000',
        managerEmail: 'manager.navi@abc-restaurant.local',
        managerName: 'Sanya Mehta',
      },
    ],
    offers: [
      {
        title: '20% off on weekday lunch buffet',
        slug: 'weekday-lunch-20',
        description: 'Flat 20% off on lunch buffet, Mon–Fri, 12–3 pm',
        offerType: OfferType.PERCENTAGE,
        discountValue: 20,
        daysValid: 30,
        isFeatured: true,
      },
      {
        title: 'Buy one main course, get one free',
        slug: 'bogo-main',
        description: 'BOGO on any main course on weekends',
        offerType: OfferType.BUY_ONE_GET_ONE,
        discountValue: 100,
        daysValid: 14,
      },
    ],
  },
  {
    name: 'SunRise Hotels',
    slug: 'sunrise-hotels',
    businessType: BusinessType.HOTEL,
    description: 'Boutique hotels in scenic getaways',
    ownerEmail: 'owner@sunrise-hotels.local',
    ownerName: 'Neha Verma',
    categorySlugs: ['travel-stay'],
    branches: [
      {
        name: 'SunRise — Goa',
        slug: 'goa',
        city: 'Panaji',
        state: 'Goa',
        addressLine1: 'Miramar Beach Road',
        postalCode: '403001',
        latitude: 15.4909,
        longitude: 73.8278,
        phone: '+918322300000',
        managerEmail: 'manager.goa@sunrise-hotels.local',
        managerName: 'Carlos Pereira',
      },
      {
        name: 'SunRise — Manali',
        slug: 'manali',
        city: 'Manali',
        state: 'Himachal Pradesh',
        addressLine1: 'Old Manali Road',
        postalCode: '175131',
        latitude: 32.2396,
        longitude: 77.1887,
        phone: '+911902250000',
        managerEmail: 'manager.manali@sunrise-hotels.local',
        managerName: 'Tara Negi',
      },
    ],
    offers: [
      {
        title: 'Monsoon escape — 30% off 3-night stays',
        slug: 'monsoon-30',
        description: 'Limited-time monsoon rates with complimentary breakfast',
        offerType: OfferType.PERCENTAGE,
        discountValue: 30,
        daysValid: 60,
        isFeatured: true,
      },
    ],
  },
  {
    name: 'UrbanCart',
    slug: 'urbancart',
    businessType: BusinessType.SHOP,
    description: 'Urban lifestyle shopping destination',
    ownerEmail: 'owner@urbancart.local',
    ownerName: 'Rahul Khanna',
    categorySlugs: ['shopping'],
    branches: [
      {
        name: 'UrbanCart — Bangalore',
        slug: 'bangalore',
        city: 'Bengaluru',
        state: 'Karnataka',
        addressLine1: 'Indiranagar 100 Feet Road',
        postalCode: '560038',
        latitude: 12.9784,
        longitude: 77.6408,
        phone: '+918025001111',
        managerEmail: 'manager.blr@urbancart.local',
        managerName: 'Anita Rao',
      },
    ],
    offers: [
      {
        title: 'Flat ₹500 off on purchases above ₹2000',
        slug: 'flat-500',
        description: 'Apply at checkout. Valid in-store only.',
        offerType: OfferType.FLAT,
        discountValue: 500,
        daysValid: 21,
      },
    ],
  },
  {
    name: 'GlamSalon',
    slug: 'glamsalon',
    businessType: BusinessType.SALON,
    description: 'Premium hair and beauty studio',
    ownerEmail: 'owner@glamsalon.local',
    ownerName: 'Pooja Iyer',
    categorySlugs: ['beauty-spa'],
    branches: [
      {
        name: 'GlamSalon — Delhi',
        slug: 'delhi',
        city: 'New Delhi',
        state: 'Delhi',
        addressLine1: 'Khan Market, Block A',
        postalCode: '110003',
        latitude: 28.6000,
        longitude: 77.2272,
        phone: '+911124633000',
        managerEmail: 'manager.delhi@glamsalon.local',
        managerName: 'Kabir Singh',
      },
    ],
    offers: [
      {
        title: 'First-visit hair-spa free with any color service',
        slug: 'free-spa-color',
        description: 'Complimentary hair-spa for new customers booking a color service',
        offerType: OfferType.FREE_ITEM,
        discountValue: 100,
        daysValid: 45,
      },
    ],
  },
];

const CUSTOMERS = [
  { email: 'customer1@offerhub.local', fullName: 'Aditi Sharma', city: 'Mumbai', latitude: 19.0760, longitude: 72.8777 },
  { email: 'customer2@offerhub.local', fullName: 'Rohan Das', city: 'Pune', latitude: 18.5204, longitude: 73.8567 },
  { email: 'customer3@offerhub.local', fullName: 'Ishita Roy', city: 'Bengaluru', latitude: 12.9716, longitude: 77.5946 },
];

export async function seedSampleBusinesses(
  prisma: PrismaClient,
  categories: Category[],
  roles: Role[],
): Promise<SeedSummary> {
  const passwordHash = await bcrypt.hash('Owner@12345', 10);
  const ownerRole = roles.find((r) => r.slug === 'SELLER_OWNER');
  const managerRole = roles.find((r) => r.slug === 'BUSINESS_MANAGER');
  const customerRole = roles.find((r) => r.slug === 'CUSTOMER');

  let brandCount = 0;
  let branchCount = 0;
  let managerCount = 0;
  let offerCount = 0;

  for (const spec of BRANDS) {
    const owner = await prisma.user.upsert({
      where: { email: spec.ownerEmail },
      create: {
        email: spec.ownerEmail,
        passwordHash,
        fullName: spec.ownerName,
        role: UserRole.SELLER_OWNER,
        isVerified: true,
        isActive: true,
      },
      update: { fullName: spec.ownerName, role: UserRole.SELLER_OWNER },
    });

    if (ownerRole) {
      await ensureRoleAssignment(prisma, owner.id, ownerRole.id, 'GLOBAL');
    }

    const brand = await prisma.businessBrand.upsert({
      where: { slug: spec.slug },
      create: {
        ownerId: owner.id,
        name: spec.name,
        slug: spec.slug,
        description: spec.description,
        businessType: spec.businessType,
        status: BrandStatus.ACTIVE,
        isVerified: true,
        verifiedAt: new Date(),
      },
      update: {
        name: spec.name,
        description: spec.description,
        businessType: spec.businessType,
        status: BrandStatus.ACTIVE,
      },
    });
    brandCount++;

    const matchedCategories = categories.filter((c) => spec.categorySlugs.includes(c.slug));
    for (const c of matchedCategories) {
      await prisma.brandCategory.upsert({
        where: { brandId_categoryId: { brandId: brand.id, categoryId: c.id } },
        create: { brandId: brand.id, categoryId: c.id },
        update: {},
      });
    }

    await prisma.subscription.upsert({
      where: { brandId: brand.id },
      create: {
        brandId: brand.id,
        plan: SubscriptionPlan.PREMIUM,
        status: SubscriptionStatus.ACTIVE,
        amount: 999,
        currency: 'INR',
        startDate: new Date(),
        endDate: addDays(new Date(), 30),
      },
      update: { plan: SubscriptionPlan.PREMIUM, status: SubscriptionStatus.ACTIVE },
    });

    for (const branchSpec of spec.branches) {
      const branch = await prisma.businessBranch.upsert({
        where: { brandId_slug: { brandId: brand.id, slug: branchSpec.slug } },
        create: {
          brandId: brand.id,
          name: branchSpec.name,
          slug: branchSpec.slug,
          addressLine1: branchSpec.addressLine1,
          city: branchSpec.city,
          state: branchSpec.state,
          country: 'India',
          postalCode: branchSpec.postalCode,
          latitude: branchSpec.latitude,
          longitude: branchSpec.longitude,
          phone: branchSpec.phone,
          status: BranchStatus.ACTIVE,
          workingHours: defaultWorkingHours(),
        },
        update: {
          name: branchSpec.name,
          city: branchSpec.city,
          state: branchSpec.state,
          phone: branchSpec.phone,
          status: BranchStatus.ACTIVE,
        },
      });
      branchCount++;

      const manager = await prisma.user.upsert({
        where: { email: branchSpec.managerEmail },
        create: {
          email: branchSpec.managerEmail,
          passwordHash,
          fullName: branchSpec.managerName,
          role: UserRole.BUSINESS_MANAGER,
          isVerified: true,
          isActive: true,
        },
        update: { fullName: branchSpec.managerName, role: UserRole.BUSINESS_MANAGER },
      });

      await prisma.businessManager.upsert({
        where: { userId_branchId: { userId: manager.id, branchId: branch.id } },
        create: {
          userId: manager.id,
          branchId: branch.id,
          invitedById: owner.id,
          isActive: true,
        },
        update: { isActive: true },
      });
      managerCount++;

      if (managerRole) {
        await ensureRoleAssignment(prisma, manager.id, managerRole.id, 'BRANCH', branch.id);
      }

      for (const offerSpec of spec.offers) {
        await prisma.offer.upsert({
          where: { branchId_slug: { branchId: branch.id, slug: offerSpec.slug } },
          create: {
            branchId: branch.id,
            title: offerSpec.title,
            slug: offerSpec.slug,
            description: offerSpec.description,
            offerType: offerSpec.offerType,
            discountValue: offerSpec.discountValue,
            startsAt: new Date(),
            expiresAt: addDays(new Date(), offerSpec.daysValid),
            status: OfferStatus.PUBLISHED,
            isFeatured: offerSpec.isFeatured ?? false,
            categories: matchedCategories.length
              ? { create: matchedCategories.map((c) => ({ categoryId: c.id })) }
              : undefined,
          },
          update: {
            title: offerSpec.title,
            description: offerSpec.description,
            discountValue: offerSpec.discountValue,
            status: OfferStatus.PUBLISHED,
            isFeatured: offerSpec.isFeatured ?? false,
            expiresAt: addDays(new Date(), offerSpec.daysValid),
          },
        });
        offerCount++;
      }
    }
  }

  for (const c of CUSTOMERS) {
    const customer = await prisma.user.upsert({
      where: { email: c.email },
      create: {
        email: c.email,
        passwordHash,
        fullName: c.fullName,
        city: c.city,
        latitude: c.latitude,
        longitude: c.longitude,
        country: 'India',
        role: UserRole.CUSTOMER,
        isVerified: true,
        isActive: true,
      },
      update: { fullName: c.fullName, city: c.city },
    });
    if (customerRole) {
      await ensureRoleAssignment(prisma, customer.id, customerRole.id, 'GLOBAL');
    }
  }

  return {
    brands: brandCount,
    branches: branchCount,
    managers: managerCount,
    offers: offerCount,
    customers: CUSTOMERS.length,
  };
}

async function ensureRoleAssignment(
  prisma: PrismaClient,
  userId: string,
  roleId: string,
  scopeType: 'GLOBAL' | 'BRAND' | 'BRANCH',
  scopeId?: string,
): Promise<void> {
  const existing = await prisma.userRoleAssignment.findFirst({
    where: { userId, roleId, scopeType, scopeId: scopeId ?? null },
  });
  if (!existing) {
    await prisma.userRoleAssignment.create({
      data: { userId, roleId, scopeType, scopeId },
    });
  }
}

function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

function defaultWorkingHours() {
  return {
    monday: { open: '09:00', close: '22:00' },
    tuesday: { open: '09:00', close: '22:00' },
    wednesday: { open: '09:00', close: '22:00' },
    thursday: { open: '09:00', close: '22:00' },
    friday: { open: '09:00', close: '23:00' },
    saturday: { open: '10:00', close: '23:00' },
    sunday: { open: '10:00', close: '22:00' },
  };
}
