import '../../../../core/network/api_envelope.dart';
import '../entities/offer.dart';
import '../repositories/offers_repository.dart';

class GetNearbyOffersUseCase {
  GetNearbyOffersUseCase(this._repo);
  final OffersRepository _repo;
  Future<Paginated<Offer>> call({
    required double latitude,
    required double longitude,
    double radiusKm = 10,
    String? categoryId,
    int page = 1,
    int limit = 20,
  }) =>
      _repo.nearby(
        latitude: latitude,
        longitude: longitude,
        radiusKm: radiusKm,
        categoryId: categoryId,
        page: page,
        limit: limit,
      );
}

class SearchOffersUseCase {
  SearchOffersUseCase(this._repo);
  final OffersRepository _repo;
  Future<Paginated<Offer>> call({
    String? search,
    String? categoryId,
    String? bankId,
    bool? isFeatured,
    int page = 1,
    int limit = 20,
  }) =>
      _repo.list(
        search: search,
        categoryId: categoryId,
        bankId: bankId,
        isFeatured: isFeatured,
        page: page,
        limit: limit,
      );
}

class GetOfferDetailUseCase {
  GetOfferDetailUseCase(this._repo);
  final OffersRepository _repo;
  Future<Offer> call(String id) => _repo.getById(id);
}

class ListCategoriesUseCase {
  ListCategoriesUseCase(this._repo);
  final OffersRepository _repo;
  Future<List<Category>> call() => _repo.categories();
}

class ListBanksUseCase {
  ListBanksUseCase(this._repo);
  final OffersRepository _repo;
  Future<List<Bank>> call() => _repo.banks();
}
