import '../../domain/entities/brand.dart';

class BrandModel {
  BrandModel({
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

  factory BrandModel.fromJson(Map<String, dynamic> j) {
    final brandType = j['brandType'];
    return BrandModel(
      id: j['id'] as String,
      name: j['name'] as String,
      slug: j['slug'] as String,
      description: j['description'] as String?,
      logoUrl: j['logoUrl'] as String?,
      coverImageUrl: j['coverImageUrl'] as String?,
      contactPhone: j['contactPhone'] as String?,
      contactEmail: j['contactEmail'] as String?,
      websiteUrl: j['websiteUrl'] as String?,
      brandTypeId: j['brandTypeId'] as String?,
      brandTypeName: brandType is Map<String, dynamic> ? brandType['name'] as String? : null,
    );
  }

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

  Brand toEntity() => Brand(
        id: id,
        name: name,
        slug: slug,
        description: description,
        logoUrl: logoUrl,
        coverImageUrl: coverImageUrl,
        contactPhone: contactPhone,
        contactEmail: contactEmail,
        websiteUrl: websiteUrl,
        brandTypeId: brandTypeId,
        brandTypeName: brandTypeName,
      );
}
