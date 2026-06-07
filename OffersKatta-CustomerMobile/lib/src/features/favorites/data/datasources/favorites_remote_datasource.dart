import '../../../../core/constants/api_constants.dart';
import '../../../../core/network/api_client.dart';
import '../../../offers/data/models/offer_model.dart';

class FavoritesRemoteDataSource {
  FavoritesRemoteDataSource(this._api);
  final ApiClient _api;

  Future<List<OfferModel>> list({int page = 1, int limit = 50}) async {
    final res = await _api.getPaginated<OfferModel>(
      ApiConstants.favorites,
      query: {'page': page, 'limit': limit},
      fromJson: (json) {
        // server returns { id, offer: {...} }
        final inner = json['offer'] as Map<String, dynamic>;
        return OfferModel.fromJson(inner);
      },
    );
    return res.items;
  }

  Future<void> add(String offerId) =>
      _api.post(ApiConstants.favoriteById(offerId), decode: (_) => null);

  Future<void> remove(String offerId) =>
      _api.delete(ApiConstants.favoriteById(offerId), decode: (_) => null);
}
