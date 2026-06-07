import { slugify, uniqueSlugSuffix } from './slug';

describe('slug utils', () => {
  it('slugifies a simple name', () => {
    expect(slugify('ABC Restaurant')).toBe('abc-restaurant');
  });

  it('drops punctuation and collapses whitespace', () => {
    expect(slugify("McDonald's — Pune, India!")).toBe('mcdonald-s-pune-india');
  });

  it('caps length at 80', () => {
    expect(slugify('a'.repeat(200)).length).toBe(80);
  });

  it('uniqueSlugSuffix returns base when attempt=0', () => {
    expect(uniqueSlugSuffix('foo', 0)).toBe('foo');
  });

  it('uniqueSlugSuffix appends number when attempt>0', () => {
    expect(uniqueSlugSuffix('foo', 3)).toBe('foo-3');
  });
});
