import '../../../../core/error/exceptions.dart';
import '../../../../core/error/failure.dart';
import '../../domain/entities/offer.dart';
import '../datasources/offers_remote_datasource.dart';

class OffersRepository {
  OffersRepository(this._remote);
  final OffersRemoteDataSource _remote;

  Future<List<Offer>> listForBrand(String brandId) async {
    try {
      final m = await _remote.listForBrand(brandId);
      return m.map((e) => e.toEntity()).toList(growable: false);
    } on ApiException catch (e) {
      throw _map(e);
    }
  }

  Future<Offer> getById(String id) async {
    try {
      return (await _remote.getById(id)).toEntity();
    } on ApiException catch (e) {
      throw _map(e);
    }
  }

  Future<Offer> create(Map<String, dynamic> body) async {
    try {
      return (await _remote.create(body)).toEntity();
    } on ApiException catch (e) {
      throw _map(e);
    }
  }

  Future<Offer> update(String id, Map<String, dynamic> patch) async {
    try {
      return (await _remote.update(id, patch)).toEntity();
    } on ApiException catch (e) {
      throw _map(e);
    }
  }

  Future<void> delete(String id) async {
    try {
      await _remote.delete(id);
    } on ApiException catch (e) {
      throw _map(e);
    }
  }

  Future<String> uploadFile({required List<int> bytes, required String filename}) async {
    try {
      return await _remote.uploadFile(bytes: bytes, filename: filename);
    } on ApiException catch (e) {
      throw _map(e);
    }
  }

  Future<List<BankCatalog>> banks() async {
    try {
      return await _remote.banks();
    } on ApiException catch (e) {
      throw _map(e);
    }
  }

  Failure _map(ApiException e) {
    if (e is NetworkException) return NetworkFailure(e.message);
    if (e is UnauthorizedException) return AuthFailure(e.message);
    return ServerFailure(e.message, statusCode: e.statusCode, code: e.code);
  }
}
