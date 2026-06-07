import '../../../../core/constants/api_constants.dart';
import '../../../../core/network/api_client.dart';
import '../models/redemption_models.dart';

class RedemptionsRemoteDataSource {
  RedemptionsRemoteDataSource(this._api);
  final ApiClient _api;

  /// Confirm a customer's pending QR.
  /// Returns the updated redemption (status will be REDEEMED if successful).
  Future<RedemptionInfo> confirm({
    required String qrCode,
    num? finalAmount,
    String? notes,
  }) {
    return _api.post<RedemptionInfo>(
      ApiConstants.redemptionConfirm(qrCode),
      body: {
        if (finalAmount != null) 'finalAmount': finalAmount,
        if (notes != null && notes.isNotEmpty) 'notes': notes,
      },
      decode: (json) => RedemptionInfo.fromJson(json as Map<String, dynamic>),
    );
  }

  /// Recent redemptions at a branch — for the "recent scans" panel and
  /// reconciliation. Returns the page directly; the API wraps a list under
  /// `data`, which the ApiClient strips via the success envelope.
  Future<List<RedemptionInfo>> forBranch(String branchId, {int page = 1, int limit = 20}) {
    return _api.get<List<RedemptionInfo>>(
      ApiConstants.redemptionsForBranch(branchId),
      query: {'page': page, 'limit': limit},
      decode: (json) {
        // API uses paginate(): returns { data: [...], meta: ... } under the
        // success envelope. ApiClient unwraps success.data here, which is the
        // whole paginated object — pick its inner `data`.
        if (json is List) {
          return json
              .whereType<Map<String, dynamic>>()
              .map(RedemptionInfo.fromJson)
              .toList(growable: false);
        }
        if (json is Map<String, dynamic>) {
          final inner = json['data'];
          if (inner is List) {
            return inner
                .whereType<Map<String, dynamic>>()
                .map(RedemptionInfo.fromJson)
                .toList(growable: false);
          }
        }
        return const [];
      },
    );
  }
}
