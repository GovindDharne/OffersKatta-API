import '../../domain/entities/offer.dart';

class OfferModel {
  OfferModel(this._json);
  final Map<String, dynamic> _json;

  factory OfferModel.fromJson(Map<String, dynamic> j) => OfferModel(j);

  Offer toEntity() {
    final j = _json;
    final cardTypesRaw = (j['cardTypes'] as List<dynamic>? ?? const []);
    final platformsRaw = (j['platforms'] as List<dynamic>? ?? const []);
    final branch = j['branch'];
    return Offer(
      id: j['id'] as String,
      branchId: j['branchId'] as String,
      title: j['title'] as String,
      description: j['description'] as String?,
      offerType: j['offerType'] as String,
      discountValue: (j['discountValue'] as num).toDouble(),
      couponCode: j['couponCode'] as String?,
      maxDiscountAmount: (j['maxDiscountAmount'] as num?)?.toDouble(),
      minPurchaseAmount: (j['minPurchaseAmount'] as num?)?.toDouble(),
      startsAt: DateTime.parse(j['startsAt'] as String),
      expiresAt: DateTime.parse(j['expiresAt'] as String),
      status: j['status'] as String,
      isFeatured: j['isFeatured'] as bool? ?? false,
      featuredUntil: j['featuredUntil'] != null ? DateTime.parse(j['featuredUntil'] as String) : null,
      images: (j['images'] as List<dynamic>? ?? const []).whereType<String>().toList(growable: false),
      listImage: j['listImage'] as String?,
      videoUrl: j['videoUrl'] as String?,
      tags: (j['tags'] as List<dynamic>? ?? const []).whereType<String>().toList(growable: false),
      cardOffers: cardTypesRaw.whereType<Map<String, dynamic>>().map((m) {
        final card = m['cardType'] as Map<String, dynamic>?;
        final bank = card?['bank'] as Map<String, dynamic>?;
        return CardOffer(
          cardTypeId: m['cardTypeId'] as String,
          cardCategory: m['cardCategory'] as String?,
          benefitType: m['benefitType'] as String?,
          benefitValue: m['benefitValue'] as String?,
          minSpend: (m['minSpend'] as num?)?.toDouble(),
          maxBenefit: (m['maxBenefit'] as num?)?.toDouble(),
          bankName: bank?['name'] as String?,
          cardName: card?['name'] as String?,
        );
      }).toList(growable: false),
      platforms: platformsRaw
          .whereType<Map<String, dynamic>>()
          .map((m) => OfferPlatform(
                platformName: m['platformName'] as String,
                url: m['url'] as String?,
              ))
          .toList(growable: false),
      viewCount: (j['viewCount'] as num?)?.toInt(),
      brandName: branch is Map<String, dynamic>
          ? (branch['brand'] is Map<String, dynamic>
              ? (branch['brand'] as Map<String, dynamic>)['name'] as String?
              : null)
          : null,
      branchName: branch is Map<String, dynamic> ? branch['name'] as String? : null,
    );
  }
}
