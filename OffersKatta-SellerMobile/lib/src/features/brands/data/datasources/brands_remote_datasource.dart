import '../../../../core/constants/api_constants.dart';
import '../../../../core/network/api_client.dart';
import '../../domain/entities/brand.dart';
import '../models/brand_model.dart';

class BrandsRemoteDataSource {
  BrandsRemoteDataSource(this._api);
  final ApiClient _api;

  Future<List<BrandModel>> listMine() async {
    final page = await _api.getPaginated<BrandModel>(
      ApiConstants.brandsMine,
      query: {'limit': 100},
      fromJson: BrandModel.fromJson,
    );
    return page.items;
  }

  Future<BrandModel> create(Map<String, dynamic> body) {
    return _api.post(
      ApiConstants.brands,
      body: body,
      decode: (json) => BrandModel.fromJson(json as Map<String, dynamic>),
    );
  }

  Future<BrandModel> update(String id, Map<String, dynamic> body) {
    return _api.patch(
      ApiConstants.brandById(id),
      body: body,
      decode: (json) => BrandModel.fromJson(json as Map<String, dynamic>),
    );
  }

  Future<void> delete(String id) =>
      _api.delete(ApiConstants.brandById(id), decode: (_) => null);

  Future<List<BrandType>> brandTypes() {
    return _api.get(
      '/brand-types',
      decode: (json) => (json as List<dynamic>)
          .whereType<Map<String, dynamic>>()
          .map((m) => BrandType(
                id: m['id'] as String,
                name: m['name'] as String,
                slug: m['slug'] as String,
              ))
          .toList(growable: false),
    );
  }
}
