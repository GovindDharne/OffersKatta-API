import type { Category, PrismaClient } from '@prisma/client';

const CATEGORIES: Array<{
  name: string;
  slug: string;
  description: string;
  iconUrl?: string;
  sortOrder: number;
}> = [
  { name: 'Food & Drink', slug: 'food-drink', description: 'Restaurants, cafes, bars', sortOrder: 1 },
  { name: 'Beauty & Spa', slug: 'beauty-spa', description: 'Salons, spas, skincare', sortOrder: 2 },
  { name: 'Fitness', slug: 'fitness', description: 'Gyms, yoga, sports', sortOrder: 3 },
  { name: 'Travel & Stay', slug: 'travel-stay', description: 'Hotels, resorts, homestays', sortOrder: 4 },
  { name: 'Shopping', slug: 'shopping', description: 'Apparel, electronics, retail', sortOrder: 5 },
  { name: 'Health', slug: 'health', description: 'Pharmacy, clinics, wellness', sortOrder: 6 },
  { name: 'Entertainment', slug: 'entertainment', description: 'Movies, events, gaming', sortOrder: 7 },
  { name: 'Services', slug: 'services', description: 'Repair, cleaning, professional services', sortOrder: 8 },
  { name: 'Education', slug: 'education', description: 'Courses, classes, tutoring', sortOrder: 9 },
  { name: 'Automobile', slug: 'automobile', description: 'Servicing, accessories, rentals', sortOrder: 10 },
];

export async function seedCategories(prisma: PrismaClient): Promise<Category[]> {
  const created: Category[] = [];
  for (const c of CATEGORIES) {
    const category = await prisma.category.upsert({
      where: { slug: c.slug },
      create: c,
      update: { name: c.name, description: c.description, sortOrder: c.sortOrder },
    });
    created.push(category);
  }
  return created;
}
