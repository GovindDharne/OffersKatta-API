import '../../../../core/error/exceptions.dart';
import '../../../../core/error/failure.dart';
import '../../domain/entities/branch.dart';
import '../datasources/branches_remote_datasource.dart';

class BranchesRepository {
  BranchesRepository(this._remote);
  final BranchesRemoteDataSource _remote;

  Future<List<BusinessBranch>> listForBrand(String brandId) async {
    try {
      final models = await _remote.listForBrand(brandId);
      return models.map((m) => m.toEntity()).toList(growable: false);
    } on ApiException catch (e) {
      throw _map(e);
    }
  }

  Future<BusinessBranch> create(Map<String, dynamic> body) async {
    try {
      return (await _remote.create(body)).toEntity();
    } on ApiException catch (e) {
      throw _map(e);
    }
  }

  Future<BusinessBranch> update(String id, Map<String, dynamic> patch) async {
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

  Failure _map(ApiException e) {
    if (e is NetworkException) return NetworkFailure(e.message);
    if (e is UnauthorizedException) return AuthFailure(e.message);
    return ServerFailure(e.message, statusCode: e.statusCode, code: e.code);
  }
}
