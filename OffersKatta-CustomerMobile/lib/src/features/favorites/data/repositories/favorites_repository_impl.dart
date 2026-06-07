import '../../../../core/error/exceptions.dart';
import '../../../../core/error/failure.dart';
import '../../../offers/domain/entities/offer.dart';
import '../../domain/repositories/favorites_repository.dart';
import '../datasources/favorites_remote_datasource.dart';

class FavoritesRepositoryImpl implements FavoritesRepository {
  FavoritesRepositoryImpl(this._remote);
  final FavoritesRemoteDataSource _remote;

  @override
  Future<List<Offer>> list({int page = 1, int limit = 50}) async {
    try {
      final models = await _remote.list(page: page, limit: limit);
      return models.map((m) => m.toEntity()).toList(growable: false);
    } on ApiException catch (e) {
      throw _map(e);
    }
  }

  @override
  Future<void> add(String offerId) async {
    try { await _remote.add(offerId); }
    on ApiException catch (e) { throw _map(e); }
  }

  @override
  Future<void> remove(String offerId) async {
    try { await _remote.remove(offerId); }
    on ApiException catch (e) { throw _map(e); }
  }

  Failure _map(ApiException e) {
    if (e is NetworkException) return NetworkFailure(e.message);
    if (e is UnauthorizedException) return AuthFailure(e.message);
    return ServerFailure(e.message, statusCode: e.statusCode);
  }
}
