import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/di/providers.dart';
import '../../../offers/domain/entities/offer.dart';
import '../../data/datasources/favorites_remote_datasource.dart';
import '../../data/repositories/favorites_repository_impl.dart';
import '../../domain/repositories/favorites_repository.dart';
import '../../domain/usecases/favorites_usecases.dart';

final favoritesRemoteProvider = Provider<FavoritesRemoteDataSource>(
  (ref) => FavoritesRemoteDataSource(ref.watch(apiClientProvider)),
);

final favoritesRepositoryProvider = Provider<FavoritesRepository>(
  (ref) => FavoritesRepositoryImpl(ref.watch(favoritesRemoteProvider)),
);

final listFavoritesUseCaseProvider = Provider((ref) => ListFavoritesUseCase(ref.watch(favoritesRepositoryProvider)));
final addFavoriteUseCaseProvider = Provider((ref) => AddFavoriteUseCase(ref.watch(favoritesRepositoryProvider)));
final removeFavoriteUseCaseProvider = Provider((ref) => RemoveFavoriteUseCase(ref.watch(favoritesRepositoryProvider)));

class FavoritesController extends StateNotifier<AsyncValue<List<Offer>>> {
  FavoritesController(this._ref) : super(const AsyncValue.loading()) {
    refresh();
  }

  final Ref _ref;

  Future<void> refresh() async {
    state = const AsyncValue.loading();
    try {
      final items = await _ref.read(listFavoritesUseCaseProvider)();
      state = AsyncValue.data(items);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  Future<void> add(String offerId) async {
    await _ref.read(addFavoriteUseCaseProvider)(offerId);
    await refresh();
  }

  Future<void> remove(String offerId) async {
    await _ref.read(removeFavoriteUseCaseProvider)(offerId);
    await refresh();
  }
}

final favoritesControllerProvider =
    StateNotifierProvider<FavoritesController, AsyncValue<List<Offer>>>((ref) => FavoritesController(ref));
