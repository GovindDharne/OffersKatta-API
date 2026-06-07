class Brand {
  Brand({
    required this.id,
    required this.name,
    required this.slug,
    this.description,
    this.logoUrl,
    this.coverImageUrl,
    this.contactPhone,
    this.contactEmail,
    this.websiteUrl,
    this.brandTypeId,
    this.brandTypeName,
  });
  final String id;
  final String name;
  final String slug;
  final String? description;
  final String? logoUrl;
  final String? coverImageUrl;
  final String? contactPhone;
  final String? contactEmail;
  final String? websiteUrl;
  final String? brandTypeId;
  final String? brandTypeName;
}

class BrandType {
  const BrandType({required this.id, required this.name, required this.slug});
  final String id;
  final String name;
  final String slug;
}
