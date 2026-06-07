import '../../../offers/domain/entities/offer.dart';
import '../repositories/favorites_repository.dart';

class ListFavoritesUseCase {
  ListFavoritesUseCase(this._repo);
  final FavoritesRepository _repo;
  Future<List<Offer>> call() => _repo.list();
}

class AddFavoriteUseCase {
  AddFavoriteUseCase(this._repo);
  final FavoritesRepository _repo;
  Future<void> call(String offerId) => _repo.add(offerId);
}

class RemoveFavoriteUseCase {
  RemoveFavoriteUseCase(this._repo);
  final FavoritesRepository _repo;
  Future<void> call(String offerId) => _repo.remove(offerId);
}
