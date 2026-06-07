import '../../../../core/error/exceptions.dart';
import '../../../../core/error/failure.dart';
import '../../../../core/network/api_envelope.dart';
import '../../domain/entities/offer.dart';
import '../../domain/repositories/offers_repository.dart';
import '../datasources/offers_remote_datasource.dart';

class OffersRepositoryImpl implements OffersRepository {
  OffersRepositoryImpl(this._remote);
  final OffersRemoteDataSource _remote;

  @override
  Future<Paginated<Offer>> list({
    String? search,
    String? categoryId,
    String? bankId,
    bool? isFeatured,
    int page = 1,
    int limit = 20,
  }) async {
    try {
      final res = await _remote.list(
        search: search,
        categoryId: categoryId,
        bankId: bankId,
        isFeatured: isFeatured,
        page: page,
        limit: limit,
      );
      return Paginated<Offer>(
        items: res.items.map((m) => m.toEntity()).toList(growable: false),
        meta: res.meta,
      );
    } on ApiException catch (e) {
      throw _map(e);
    }
  }

  @override
  Future<Paginated<Offer>> nearby({
    required double latitude,
    required double longitude,
    double radiusKm = 10,
    String? categoryId,
    String? bankId,
    int page = 1,
    int limit = 20,
  }) async {
    try {
      final res = await _remote.nearby(
        latitude: latitude,
        longitude: longitude,
        radiusKm: radiusKm,
        categoryId: categoryId,
        bankId: bankId,
        page: page,
        limit: limit,
      );
      return Paginated<Offer>(
        items: res.items.map((m) => m.toEntity()).toList(growable: false),
        meta: res.meta,
      );
    } on ApiException catch (e) {
      throw _map(e);
    }
  }

  @override
  Future<Offer> getById(String id) async {
    try {
      return (await _remote.getById(id)).toEntity();
    } on ApiException catch (e) {
      throw _map(e);
    }
  }

  @override
  Future<List<Category>> categories() async {
    try {
      return await _remote.categories();
    } on ApiException catch (e) {
      throw _map(e);
    }
  }

  @override
  Future<List<Bank>> banks() async {
    try {
      return await _remote.banks();
    } on ApiException catch (e) {
      throw _map(e);
    }
  }

  @override
  Future<void> trackClick(String id) => _remote.trackClick(id);

  @override
  Future<void> trackShare(String id) => _remote.trackShare(id);

  Failure _map(ApiException e) {
    if (e is NetworkException) return NetworkFailure(e.message);
    if (e is UnauthorizedException) return AuthFailure(e.message);
    return ServerFailure(e.message, statusCode: e.statusCode, code: e.code);
  }
}
