import '../../../../core/error/exceptions.dart';
import '../../../../core/error/failure.dart';
import '../../domain/entities/redemption.dart';
import '../../domain/repositories/redemptions_repository.dart';
import '../datasources/redemptions_remote_datasource.dart';

class RedemptionsRepositoryImpl implements RedemptionsRepository {
  RedemptionsRepositoryImpl(this._remote);
  final RedemptionsRemoteDataSource _remote;

  @override
  Future<IssuedRedemption> issueFor(String offerId) async {
    try {
      return (await _remote.issueFor(offerId)).toEntity();
    } on ApiException catch (e) {
      throw _map(e);
    }
  }

  @override
  Future<void> cancel(String qrCode) async {
    try { await _remote.cancel(qrCode); }
    on ApiException catch (e) { throw _map(e); }
  }

  @override
  Future<List<Redemption>> mine({int page = 1, int limit = 50}) async {
    try {
      final res = await _remote.mine(page: page, limit: limit);
      return res.map((m) => m.toEntity()).toList(growable: false);
    } on ApiException catch (e) {
      throw _map(e);
    }
  }

  Failure _map(ApiException e) {
    if (e is NetworkException) return NetworkFailure(e.message);
    if (e is UnauthorizedException) return AuthFailure(e.message);
    return ServerFailure(e.message, statusCode: e.statusCode);
  }
}
