import '../../../../core/constants/api_constants.dart';
import '../../../../core/network/api_client.dart';
import '../models/branch_model.dart';

class BranchesRemoteDataSource {
  BranchesRemoteDataSource(this._api);
  final ApiClient _api;

  Future<List<BranchModel>> listForBrand(String brandId) async {
    final page = await _api.getPaginated<BranchModel>(
      ApiConstants.branches,
      query: {'brandId': brandId, 'limit': 100},
      fromJson: BranchModel.fromJson,
    );
    return page.items;
  }

  Future<BranchModel> create(Map<String, dynamic> body) {
    return _api.post(
      ApiConstants.branches,
      body: body,
      decode: (json) => BranchModel.fromJson(json as Map<String, dynamic>),
    );
  }

  Future<BranchModel> update(String id, Map<String, dynamic> body) {
    return _api.patch(
      ApiConstants.branchById(id),
      body: body,
      decode: (json) => BranchModel.fromJson(json as Map<String, dynamic>),
    );
  }

  Future<void> delete(String id) =>
      _api.delete(ApiConstants.branchById(id), decode: (_) => null);
}
