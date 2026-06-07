class BranchSummary {
  const BranchSummary({
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
}

/// One of the stores this offer reaches after scope resolution
/// (BRAND/CITY/TAGS/BRANCH). The one with `isPrimary=true` is the anchor.
class ReachableBranch {
  const ReachableBranch({
    required this.id,
    required this.name,
    required this.isPrimary,
    this.addressLine1,
    this.addressLine2,
    this.city,
    this.state,
    this.postalCode,
    this.phone,
    this.latitude,
    this.longitude,
  });

  final String id;
  final String name;
  final bool isPrimary;
  final String? addressLine1;
  final String? addressLine2;
  final String? city;
  final String? state;
  final String? postalCode;
  final String? phone;
  final double? latitude;
  final double? longitude;
}

class OfferCardOffer {
  const OfferCardOffer({
    required this.cardTypeId,
    required this.cardName,
    required this.bankId,
    required this.bankName,
    this.cardCategory,
    this.benefitType,
    this.benefitValue,
    this.minSpend,
    this.maxBenefit,
  });

  final String cardTypeId;
  final String cardName;
  final String bankId;
  final String bankName;
  final String? cardCategory;
  final String? benefitType;
  final String? benefitValue;
  final num? minSpend;
  final num? maxBenefit;
}

class OfferPlatform {
  const OfferPlatform({required this.id, required this.platformName, this.url});
  final String id;
  final String platformName;
  final String? url;
}

class OfferCategoryRef {
  const OfferCategoryRef({required this.id, required this.name});
  final String id;
  final String name;
}

class Offer {
  const Offer({
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

  /// Seller-supplied thumbnail for card/list views only. Detail page should
  /// render `images[]` and ignore this.
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
  final BranchSummary? branch;
  final double? distanceKm;

  /// All stores this offer reaches after scope resolution. Falls back to a
  /// single-entry list built from `branch` when the API doesn't send it.
  final List<ReachableBranch> reachableBranches;
  final List<OfferCardOffer> cardOffers;
  final List<OfferPlatform> platforms;
  final List<OfferCategoryRef> categories;

  bool get isActive {
    final now = DateTime.now();
    return status == 'PUBLISHED' && startsAt.isBefore(now) && expiresAt.isAfter(now);
  }

  bool get isExpired => expiresAt.isBefore(DateTime.now());
}

class Category {
  const Category({required this.id, required this.name, required this.slug, this.iconUrl});
  final String id;
  final String name;
  final String slug;
  final String? iconUrl;
}

class Bank {
  const Bank({required this.id, required this.name, required this.slug});
  final String id;
  final String name;
  final String slug;
}
