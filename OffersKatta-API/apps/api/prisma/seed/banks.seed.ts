import { CardCategory, type PrismaClient } from '@prisma/client';

interface BankSpec {
  name: string;
  slug: string;
  cards: Array<{ name: string; category?: CardCategory; network?: string }>;
}

const BANKS: BankSpec[] = [
  {
    name: 'HDFC Bank',
    slug: 'hdfc',
    cards: [
      { name: 'Credit Card (any)' },
      { name: 'Debit Card', category: CardCategory.DEBIT },
      { name: 'Regalia', network: 'VISA' },
      { name: 'Diners Club Black', network: 'DINERS' },
      { name: 'Millennia', network: 'MASTERCARD' },
      { name: 'Infinia', network: 'VISA' },
    ],
  },
  {
    name: 'ICICI Bank',
    slug: 'icici',
    cards: [
      { name: 'Credit Card (any)' },
      { name: 'Debit Card', category: CardCategory.DEBIT },
      { name: 'Coral', network: 'VISA' },
      { name: 'Amazon Pay', network: 'VISA' },
      { name: 'Sapphiro', network: 'VISA' },
      { name: 'Emeralde', network: 'AMEX' },
    ],
  },
  {
    name: 'State Bank of India',
    slug: 'sbi',
    cards: [
      { name: 'Credit Card (any)' },
      { name: 'Debit Card', category: CardCategory.DEBIT },
      { name: 'SimplyCLICK' },
      { name: 'Cashback' },
      { name: 'Elite' },
      { name: 'Aurum' },
    ],
  },
  {
    name: 'Axis Bank',
    slug: 'axis',
    cards: [
      { name: 'Credit Card (any)' },
      { name: 'Debit Card', category: CardCategory.DEBIT },
      { name: 'Magnus' },
      { name: 'Reserve' },
      { name: 'Vistara' },
      { name: 'ACE' },
    ],
  },
  {
    name: 'Kotak Mahindra Bank',
    slug: 'kotak',
    cards: [
      { name: 'Credit Card (any)' },
      { name: 'Debit Card', category: CardCategory.DEBIT },
      { name: 'Royale' },
      { name: 'White' },
      { name: 'Privy League' },
    ],
  },
  {
    name: 'IDFC First Bank',
    slug: 'idfc-first',
    cards: [
      { name: 'Credit Card (any)' },
      { name: 'Debit Card', category: CardCategory.DEBIT },
      { name: 'Wealth' },
      { name: 'Wow' },
      { name: 'Select' },
    ],
  },
  {
    name: 'American Express',
    slug: 'amex',
    cards: [
      { name: 'Credit Card (any)', network: 'AMEX' },
      { name: 'Membership Rewards', network: 'AMEX' },
      { name: 'Platinum Travel', network: 'AMEX' },
      { name: 'Platinum Reserve', network: 'AMEX' },
    ],
  },
];

export async function seedBanks(prisma: PrismaClient): Promise<{ banks: number; cards: number }> {
  let banks = 0;
  let cards = 0;
  for (const spec of BANKS) {
    const bank = await prisma.bank.upsert({
      where: { slug: spec.slug },
      create: { name: spec.name, slug: spec.slug },
      update: { name: spec.name },
    });
    banks++;
    for (const c of spec.cards) {
      await prisma.cardType.upsert({
        where: { bankId_name: { bankId: bank.id, name: c.name } },
        create: {
          bankId: bank.id,
          name: c.name,
          network: c.network,
          category: c.category ?? CardCategory.CREDIT,
        },
        update: { network: c.network, category: c.category ?? CardCategory.CREDIT },
      });
      cards++;
    }
  }
  return { banks, cards };
}
