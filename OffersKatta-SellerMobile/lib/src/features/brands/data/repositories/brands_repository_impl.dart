import '../../../../core/error/exceptions.dart';
import '../../../../core/error/failure.dart';
import '../../domain/entities/brand.dart';
import '../datasources/brands_remote_datasource.dart';

class BrandsRepository {
  BrandsRepository(this._remote);
  final BrandsRemoteDataSource _remote;

  Future<List<Brand>> listMine() async {
    try {
      final models = await _remote.listMine();
      return models.map((m) => m.toEntity()).toList(growable: false);
    } on ApiException catch (e) {
      throw _map(e);
    }
  }

  Future<Brand> create({
    required String name,
    String? description,
    String? logoUrl,
    String? coverImageUrl,
    String? contactPhone,
    String? contactEmail,
    String? websiteUrl,
    String? brandTypeId,
  }) async {
    try {
      final body = <String, dynamic>{
        'name': name,
        if (description != null && description.isNotEmpty) 'description': description,
        if (logoUrl != null && logoUrl.isNotEmpty) 'logoUrl': logoUrl,
        if (coverImageUrl != null && coverImageUrl.isNotEmpty) 'coverImageUrl': coverImageUrl,
        if (contactPhone != null && contactPhone.isNotEmpty) 'contactPhone': contactPhone,
        if (contactEmail != null && contactEmail.isNotEmpty) 'contactEmail': contactEmail,
        if (websiteUrl != null && websiteUrl.isNotEmpty) 'websiteUrl': websiteUrl,
        if (brandTypeId != null && brandTypeId.isNotEmpty) 'brandTypeId': brandTypeId,
      };
      return (await _remote.create(body)).toEntity();
    } on ApiException catch (e) {
      throw _map(e);
    }
  }

  Future<Brand> update(String id, Map<String, dynamic> patch) async {
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

  Future<List<BrandType>> brandTypes() async {
    try {
      return await _remote.brandTypes();
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
