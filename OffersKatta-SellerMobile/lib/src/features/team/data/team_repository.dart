import '../../../core/error/exceptions.dart';
import '../../../core/error/failure.dart';
import '../../../core/network/api_client.dart';

class Invitation {
  Invitation({
    required this.id,
    required this.email,
    required this.role,
    required this.status,
    required this.expiresAt,
  });
  final String id;
  final String email;
  final String role;
  final String status;
  final DateTime expiresAt;

  factory Invitation.fromJson(Map<String, dynamic> j) => Invitation(
        id: j['id'] as String,
        email: j['email'] as String,
        role: j['role'] as String,
        status: j['status'] as String,
        expiresAt: DateTime.parse(j['expiresAt'] as String),
      );
}

class TeamRepository {
  TeamRepository(this._api);
  final ApiClient _api;

  Future<List<Invitation>> listInvitations(String brandId) async {
    try {
      return await _api.get<List<Invitation>>(
        '/team/invitations',
        query: {'brandId': brandId},
        decode: (json) => (json as List<dynamic>)
            .whereType<Map<String, dynamic>>()
            .map(Invitation.fromJson)
            .toList(growable: false),
      );
    } on ApiException catch (e) {
      throw _map(e);
    }
  }

  Future<void> invite({
    required String brandId,
    String? branchId,
    required String email,
    required String role,
  }) async {
    try {
      await _api.post('/team/invitations', body: {
        'brandId': brandId,
        if (branchId != null && branchId.isNotEmpty) 'branchId': branchId,
        'email': email,
        'role': role,
      }, decode: (_) => null);
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
