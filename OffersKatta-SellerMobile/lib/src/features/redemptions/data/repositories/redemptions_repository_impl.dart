import '../datasources/redemptions_remote_datasource.dart';
import '../models/redemption_models.dart';

class RedemptionsRepository {
  RedemptionsRepository(this._remote);
  final RedemptionsRemoteDataSource _remote;

  Future<RedemptionInfo> confirm({
    required String qrCode,
    num? finalAmount,
    String? notes,
  }) =>
      _remote.confirm(qrCode: qrCode, finalAmount: finalAmount, notes: notes);

  Future<List<RedemptionInfo>> forBranch(String branchId, {int page = 1, int limit = 20}) =>
      _remote.forBranch(branchId, page: page, limit: limit);
}
