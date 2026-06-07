import '../../../offers/domain/entities/offer.dart';

abstract class FavoritesRepository {
  Future<List<Offer>> list({int page = 1, int limit = 50});
  Future<void> add(String offerId);
  Future<void> remove(String offerId);
}
