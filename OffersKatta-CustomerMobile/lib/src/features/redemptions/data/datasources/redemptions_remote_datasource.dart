import '../../../../core/constants/api_constants.dart';
import '../../../../core/network/api_client.dart';
import '../models/redemption_model.dart';

class RedemptionsRemoteDataSource {
  RedemptionsRemoteDataSource(this._api);
  final ApiClient _api;

  Future<IssuedRedemptionModel> issueFor(String offerId) {
    return _api.post(
      ApiConstants.issueRedemption(offerId),
      decode: (json) => IssuedRedemptionModel.fromJson(json as Map<String, dynamic>),
    );
  }

  Future<void> cancel(String qrCode) =>
      _api.post(ApiConstants.cancelRedemption(qrCode), decode: (_) => null);

  Future<List<RedemptionModel>> mine({int page = 1, int limit = 50}) async {
    final res = await _api.getPaginated<RedemptionModel>(
      ApiConstants.myRedemptions,
      query: {'page': page, 'limit': limit},
      fromJson: RedemptionModel.fromJson,
    );
    return res.items;
  }
}
