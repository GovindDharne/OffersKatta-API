import '../../domain/entities/offer.dart';

class BranchSummaryModel {
  const BranchSummaryModel({
    required this.id,
    required this.name,
    this.city,
    this.state,
    this.addressLine1,
    this.addressLine2,
    this.postalCode,
    this.phone,
    this.latitude,
    this.longitude,
    this.brandId,
    this.brandName,
  });

  factory BranchSummaryModel.fromJson(Map<String, dynamic> json) {
    final brand = json['brand'] as Map<String, dynamic>?;
    return BranchSummaryModel(
      id: json['id'] as String,
      name: json['name'] as String? ?? '',
      city: json['city'] as String?,
      state: json['state'] as String?,
      addressLine1: json['addressLine1'] as String?,
      addressLine2: json['addressLine2'] as String?,
      postalCode: json['postalCode'] as String?,
      phone: json['phone'] as String?,
      latitude: (json['latitude'] as num?)?.toDouble(),
      longitude: (json['longitude'] as num?)?.toDouble(),
      brandId: brand?['id'] as String?,
      brandName: brand?['name'] as String?,
    );
  }

  final String id;
  final String name;
  final String? city;
  final String? state;
  final String? addressLine1;
  final String? addressLine2;
  final String? postalCode;
  final String? phone;
  final double? latitude;
  final double? longitude;
  final String? brandId;
  final String? brandName;

  BranchSummary toEntity() => BranchSummary(
        id: id,
        name: name,
        city: city,
        state: state,
        addressLine1: addressLine1,
        addressLine2: addressLine2,
        postalCode: postalCode,
        phone: phone,
        latitude: latitude,
        longitude: longitude,
        brandId: brandId,
        brandName: brandName,
      );
}

class OfferModel {
  const OfferModel({
    required this.id,
    required this.title,
    required this.offerType,
    required this.discountValue,
    required this.startsAt,
    required this.expiresAt,
    required this.status,
    required this.totalRedemptions,
    required this.viewCount,
    this.titleHindi,
    this.description,
    this.descriptionRegional,
    this.termsAndConditions,
    this.images = const [],
    this.listImage,
    this.videoUrl,
    this.couponCode,
    this.tags = const [],
    this.applicableProducts,
    this.excludedProducts,
    this.isFeatured = false,
    this.isStackable = false,
    this.visibility,
    this.isRecurring = false,
    this.recurringDays = const [],
    this.recurringStartTime,
    this.recurringEndTime,
    this.branch,
    this.distanceKm,
    this.reachableBranches = const [],
    this.cardOffers = const [],
    this.platforms = const [],
    this.categories = const [],
  });

  factory OfferModel.fromJson(Map<String, dynamic> json) {
    return OfferModel(
      id: json['id'] as String,
      title: json['title'] as String,
      titleHindi: json['titleHindi'] as String?,
      offerType: json['offerType'] as String,
      discountValue: (json['discountValue'] as num?) ?? 0,
      startsAt: DateTime.parse(json['startsAt'] as String),
      expiresAt: DateTime.parse(json['expiresAt'] as String),
      status: json['status'] as String? ?? 'DRAFT',
      totalRedemptions: (json['totalRedemptions'] as num?)?.toInt() ?? 0,
      viewCount: (json['viewCount'] as num?)?.toInt() ?? 0,
      description: json['description'] as String?,
      descriptionRegional: json['descriptionRegional'] as String?,
      termsAndConditions: json['termsAndConditions'] as String?,
      images: ((json['images'] as List?) ?? const []).whereType<String>().toList(),
      listImage: json['listImage'] as String?,
      videoUrl: json['videoUrl'] as String?,
      couponCode: json['couponCode'] as String?,
      tags: ((json['tags'] as List?) ?? const []).whereType<String>().toList(),
      applicableProducts: json['applicableProducts'] as String?,
      excludedProducts: json['excludedProducts'] as String?,
      isFeatured: json['isFeatured'] as bool? ?? false,
      isStackable: json['isStackable'] as bool? ?? false,
      visibility: json['visibility'] as String?,
      isRecurring: json['isRecurring'] as bool? ?? false,
      recurringDays:
          ((json['recurringDays'] as List?) ?? const []).whereType<num>().map((n) => n.toInt()).toList(),
      recurringStartTime: json['recurringStartTime'] as String?,
      recurringEndTime: json['recurringEndTime'] as String?,
      branch: json['branch'] is Map<String, dynamic>
          ? BranchSummaryModel.fromJson(json['branch'] as Map<String, dynamic>)
          : null,
      distanceKm: (json['distanceKm'] as num?)?.toDouble(),
      reachableBranches: _parseReachable(json['reachableBranches']),
      cardOffers: _parseCardOffers(json['cardTypes']),
      platforms: _parsePlatforms(json['platforms']),
      categories: _parseCategories(json['categories']),
    );
  }

  static List<ReachableBranch> _parseReachable(dynamic raw) {
    if (raw is! List) return const [];
    return raw
        .whereType<Map<String, dynamic>>()
        .map((j) => ReachableBranch(
              id: j['id'] as String,
              name: (j['name'] as String?) ?? '',
              isPrimary: (j['isPrimary'] as bool?) ?? false,
              addressLine1: j['addressLine1'] as String?,
              addressLine2: j['addressLine2'] as String?,
              city: j['city'] as String?,
              state: j['state'] as String?,
              postalCode: j['postalCode'] as String?,
              phone: j['phone'] as String?,
              latitude: (j['latitude'] as num?)?.toDouble(),
              longitude: (j['longitude'] as num?)?.toDouble(),
            ))
        .toList(growable: false);
  }

  static List<OfferCardOffer> _parseCardOffers(dynamic raw) {
    if (raw is! List) return const [];
    final out = <OfferCardOffer>[];
    for (final entry in raw.whereType<Map<String, dynamic>>()) {
      final ct = entry['cardType'];
      if (ct is! Map<String, dynamic>) continue;
      final bank = ct['bank'];
      if (bank is! Map<String, dynamic>) continue;
      out.add(OfferCardOffer(
        cardTypeId: ct['id'] as String,
        cardName: (ct['name'] as String?) ?? '',
        bankId: bank['id'] as String,
        bankName: (bank['name'] as String?) ?? '',
        cardCategory: entry['cardCategory'] as String?,
        benefitType: entry['benefitType'] as String?,
        benefitValue: entry['benefitValue'] as String?,
        minSpend: entry['minSpend'] as num?,
        maxBenefit: entry['maxBenefit'] as num?,
      ));
    }
    return out;
  }

  static List<OfferPlatform> _parsePlatforms(dynamic raw) {
    if (raw is! List) return const [];
    return raw
        .whereType<Map<String, dynamic>>()
        .map((j) => OfferPlatform(
              id: j['id'] as String,
              platformName: (j['platformName'] as String?) ?? '',
              url: j['url'] as String?,
            ))
        .toList(growable: false);
  }

  static List<OfferCategoryRef> _parseCategories(dynamic raw) {
    if (raw is! List) return const [];
    final out = <OfferCategoryRef>[];
    for (final entry in raw.whereType<Map<String, dynamic>>()) {
      // The API wraps categories as { category: { id, name } } join rows.
      final cat = entry['category'] is Map<String, dynamic>
          ? entry['category'] as Map<String, dynamic>
          : entry;
      final id = cat['id'];
      final name = cat['name'];
      if (id is! String || name is! String) continue;
      out.add(OfferCategoryRef(id: id, name: name));
    }
    return out;
  }

  final String id;
  final String title;
  final String? titleHindi;
  final String offerType;
  final num discountValue;
  final DateTime startsAt;
  final DateTime expiresAt;
  final String status;
  final int totalRedemptions;
  final int viewCount;
  final String? description;
  final String? descriptionRegional;
  final String? termsAndConditions;
  final List<String> images;
  final String? listImage;
  final String? videoUrl;
  final String? couponCode;
  final List<String> tags;
  final String? applicableProducts;
  final String? excludedProducts;
  final bool isFeatured;
  final bool isStackable;
  final String? visibility;
  final bool isRecurring;
  final List<int> recurringDays;
  final String? recurringStartTime;
  final String? recurringEndTime;
  final BranchSummaryModel? branch;
  final double? distanceKm;
  final List<ReachableBranch> reachableBranches;
  final List<OfferCardOffer> cardOffers;
  final List<OfferPlatform> platforms;
  final List<OfferCategoryRef> categories;

  Offer toEntity() => Offer(
        id: id,
        title: title,
        titleHindi: titleHindi,
        offerType: offerType,
        discountValue: discountValue,
        startsAt: startsAt,
        expiresAt: expiresAt,
        status: status,
        totalRedemptions: totalRedemptions,
        viewCount: viewCount,
        description: description,
        descriptionRegional: descriptionRegional,
        termsAndConditions: termsAndConditions,
        images: images,
        listImage: listImage,
        videoUrl: videoUrl,
        couponCode: couponCode,
        tags: tags,
        applicableProducts: applicableProducts,
        excludedProducts: excludedProducts,
        isFeatured: isFeatured,
        isStackable: isStackable,
        visibility: visibility,
        isRecurring: isRecurring,
        recurringDays: recurringDays,
        recurringStartTime: recurringStartTime,
        recurringEndTime: recurringEndTime,
        branch: branch?.toEntity(),
        distanceKm: distanceKm,
        reachableBranches: reachableBranches,
        cardOffers: cardOffers,
        platforms: platforms,
        categories: categories,
      );
}
