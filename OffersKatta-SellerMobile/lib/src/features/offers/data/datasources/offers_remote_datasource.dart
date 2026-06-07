import '../../../../core/constants/api_constants.dart';
import '../../../../core/network/api_client.dart';
import '../../domain/entities/offer.dart';
import '../models/offer_model.dart';

class OffersRemoteDataSource {
  OffersRemoteDataSource(this._api);
  final ApiClient _api;

  Future<List<OfferModel>> listForBrand(String brandId) async {
    final page = await _api.getPaginated<OfferModel>(
      ApiConstants.offers,
      query: {'brandId': brandId, 'limit': 100},
      fromJson: OfferModel.fromJson,
    );
    return page.items;
  }

  Future<OfferModel> getById(String id) {
    return _api.get(
      ApiConstants.offerById(id),
      decode: (json) => OfferModel.fromJson(json as Map<String, dynamic>),
    );
  }

  Future<OfferModel> create(Map<String, dynamic> body) {
    return _api.post(
      ApiConstants.offers,
      body: body,
      decode: (json) => OfferModel.fromJson(json as Map<String, dynamic>),
    );
  }

  Future<OfferModel> update(String id, Map<String, dynamic> body) {
    return _api.patch(
      ApiConstants.offerById(id),
      body: body,
      decode: (json) => OfferModel.fromJson(json as Map<String, dynamic>),
    );
  }

  Future<void> delete(String id) =>
      _api.delete(ApiConstants.offerById(id), decode: (_) => null);

  /// Uploads one file (image or video) by bytes. Works on web + mobile.
  /// Returns the URL the API stores (relative path like `/api/uploads/files/...`).
  Future<String> uploadFile({
    required List<int> bytes,
    required String filename,
  }) async {
    final url = await _api.upload<String>(
      ApiConstants.uploadFile,
      bytes: bytes,
      filename: filename,
      field: 'file',
      decode: (json) => (json as Map<String, dynamic>)['url'] as String,
    );
    return url;
  }

  Future<List<BankCatalog>> banks() {
    return _api.get(
      ApiConstants.banks,
      decode: (json) => (json as List<dynamic>)
          .whereType<Map<String, dynamic>>()
          .map((b) => BankCatalog(
                id: b['id'] as String,
                name: b['name'] as String,
                slug: b['slug'] as String,
                cards: (b['cards'] as List<dynamic>? ?? const [])
                    .whereType<Map<String, dynamic>>()
                    .map((c) => BankCard(
                          id: c['id'] as String,
                          name: c['name'] as String,
                          category: c['category'] as String? ?? 'CREDIT',
                          network: c['network'] as String?,
                        ))
                    .toList(growable: false),
              ))
          .toList(growable: false),
    );
  }
}
