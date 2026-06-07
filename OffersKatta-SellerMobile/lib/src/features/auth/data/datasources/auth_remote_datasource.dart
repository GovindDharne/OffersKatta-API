import '../../../../core/constants/api_constants.dart';
import '../../../../core/network/api_client.dart';
import '../models/auth_user_model.dart';

class AuthRemoteDataSource {
  AuthRemoteDataSource(this._api);
  final ApiClient _api;

  Future<AuthSessionDto> login(String email, String password) {
    return _api.post(
      ApiConstants.authLogin,
      body: {'email': email, 'password': password},
      decode: (json) => AuthSessionDto.fromJson(json as Map<String, dynamic>),
    );
  }

  Future<AuthUserModel> me() {
    return _api.get(
      ApiConstants.usersMe,
      decode: (json) => AuthUserModel.fromJson(json as Map<String, dynamic>),
    );
  }

  Future<void> logout() => _api.post(ApiConstants.authLogout, decode: (_) => null);
}
