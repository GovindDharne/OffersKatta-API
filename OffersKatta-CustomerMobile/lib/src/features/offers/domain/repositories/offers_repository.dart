import '../../../../core/network/api_envelope.dart';
import '../entities/offer.dart';

abstract class OffersRepository {
  Future<Paginated<Offer>> list({
    String? search,
    String? categoryId,
    String? bankId,
    bool? isFeatured,
    int page = 1,
    int limit = 20,
  });

  Future<Paginated<Offer>> nearby({
    required double latitude,
    required double longitude,
    double radiusKm = 10,
    String? categoryId,
    String? bankId,
    int page = 1,
    int limit = 20,
  });

  Future<Offer> getById(String id);

  Future<List<Category>> categories();
  Future<List<Bank>> banks();

  Future<void> trackClick(String id);
  Future<void> trackShare(String id);
}
