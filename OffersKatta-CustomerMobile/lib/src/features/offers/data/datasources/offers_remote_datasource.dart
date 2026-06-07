import '../../../../core/constants/api_constants.dart';
import '../../../../core/network/api_client.dart';
import '../../../../core/network/api_envelope.dart';
import '../../domain/entities/offer.dart';
import '../models/offer_model.dart';

class OffersRemoteDataSource {
  OffersRemoteDataSource(this._api);
  final ApiClient _api;

  Future<Paginated<OfferModel>> list({
    String? search,
    String? categoryId,
    String? bankId,
    bool? isFeatured,
    int page = 1,
    int limit = 20,
  }) {
    return _api.getPaginated<OfferModel>(
      ApiConstants.offers,
      query: {
        if (search != null && search.isNotEmpty) 'search': search,
        if (categoryId != null) 'categoryId': categoryId,
        if (bankId != null) 'bankId': bankId,
        if (isFeatured != null) 'isFeatured': isFeatured,
        'status': 'PUBLISHED',
        'page': page,
        'limit': limit,
      },
      fromJson: OfferModel.fromJson,
    );
  }

  Future<Paginated<OfferModel>> nearby({
    required double latitude,
    required double longitude,
    double radiusKm = 10,
    String? categoryId,
    String? bankId,
    int page = 1,
    int limit = 20,
  }) {
    return _api.getPaginated<OfferModel>(
      ApiConstants.offersNearby,
      query: {
        'latitude': latitude,
        'longitude': longitude,
        'radiusKm': radiusKm,
        if (categoryId != null) 'categoryId': categoryId,
        if (bankId != null) 'bankId': bankId,
        'page': page,
        'limit': limit,
      },
      fromJson: OfferModel.fromJson,
    );
  }

  Future<OfferModel> getById(String id) {
    return _api.get(
      ApiConstants.offerById(id),
      decode: (json) => OfferModel.fromJson(json as Map<String, dynamic>),
    );
  }

  Future<List<Category>> categories() {
    return _api.get(
      ApiConstants.categories,
      decode: (json) => (json as List<dynamic>)
          .whereType<Map<String, dynamic>>()
          .map((m) => Category(
                id: m['id'] as String,
                name: m['name'] as String,
                slug: m['slug'] as String,
                iconUrl: m['iconUrl'] as String?,
              ))
          .toList(growable: false),
    );
  }

  Future<List<Bank>> banks() {
    return _api.get(
      ApiConstants.banks,
      decode: (json) => (json as List<dynamic>)
          .whereType<Map<String, dynamic>>()
          .map((m) => Bank(
                id: m['id'] as String,
                name: m['name'] as String,
                slug: m['slug'] as String,
              ))
          .toList(growable: false),
    );
  }

  Future<void> trackClick(String id) =>
      _api.post('/offers/$id/click', decode: (_) => null);

  Future<void> trackShare(String id) =>
      _api.post('/offers/$id/share', decode: (_) => null);
}
