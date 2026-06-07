class CardOffer {
  CardOffer({
    required this.cardTypeId,
    this.cardCategory,
    this.benefitType,
    this.benefitValue,
    this.minSpend,
    this.maxBenefit,
    this.bankName,
    this.cardName,
  });
  final String cardTypeId;
  final String? cardCategory;
  final String? benefitType;
  final String? benefitValue;
  final double? minSpend;
  final double? maxBenefit;
  // Joined fields from the API (for display only):
  final String? bankName;
  final String? cardName;
}

class OfferPlatform {
  OfferPlatform({required this.platformName, this.url});
  final String platformName;
  final String? url;
}

class Offer {
  Offer({
    required this.id,
    required this.branchId,
    required this.title,
    required this.offerType,
    required this.discountValue,
    required this.startsAt,
    required this.expiresAt,
    required this.status,
    required this.isFeatured,
    required this.images,
    required this.tags,
    required this.cardOffers,
    required this.platforms,
    this.description,
    this.couponCode,
    this.maxDiscountAmount,
    this.minPurchaseAmount,
    this.listImage,
    this.videoUrl,
    this.featuredUntil,
    this.viewCount,
    this.brandName,
    this.branchName,
  });
  final String id;
  final String branchId;
  final String title;
  final String? description;
  final String offerType;
  final double discountValue;
  final String? couponCode;
  final double? maxDiscountAmount;
  final double? minPurchaseAmount;
  final DateTime startsAt;
  final DateTime expiresAt;
  final String status;
  final bool isFeatured;
  final DateTime? featuredUntil;
  final List<String> images;
  final String? listImage;
  final String? videoUrl;
  final List<String> tags;
  final List<CardOffer> cardOffers;
  final List<OfferPlatform> platforms;
  final int? viewCount;
  final String? brandName;
  final String? branchName;

  bool get isPublished => status == 'PUBLISHED';
}

class BankCatalog {
  const BankCatalog({required this.id, required this.name, required this.slug, required this.cards});
  final String id;
  final String name;
  final String slug;
  final List<BankCard> cards;
}

class BankCard {
  const BankCard({required this.id, required this.name, required this.category, this.network});
  final String id;
  final String name;
  final String category;
  final String? network;
}
