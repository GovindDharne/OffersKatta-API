import 'package:dio/dio.dart';

import '../../../../core/constants/api_constants.dart';
import '../../../../core/network/api_client.dart';
import '../../domain/entities/auth_user.dart';
import '../models/auth_user_model.dart';

class AuthSessionDto {
  AuthSessionDto({
    required this.accessToken,
    required this.refreshToken,
    required this.expiresIn,
    required this.user,
  });

  factory AuthSessionDto.fromJson(Map<String, dynamic> json) => AuthSessionDto(
        accessToken: json['accessToken'] as String,
        refreshToken: json['refreshToken'] as String,
        expiresIn: json['expiresIn'] as int? ?? 900,
        user: AuthUserModel.fromJson(json['user'] as Map<String, dynamic>),
      );

  final String accessToken;
  final String refreshToken;
  final int expiresIn;
  final AuthUserModel user;
}

class AuthRemoteDataSource {
  AuthRemoteDataSource(this._api);
  final ApiClient _api;

  Future<AuthSessionDto> login({required String email, required String password}) {
    return _api.post(
      ApiConstants.authLogin,
      body: {'email': email, 'password': password},
      decode: (json) => AuthSessionDto.fromJson(json as Map<String, dynamic>),
    );
  }

  Future<AuthSessionDto> register({
    required String email,
    required String password,
    required String fullName,
    required UserRole role,
  }) {
    return _api.post(
      ApiConstants.authRegister,
      body: {
        'email': email,
        'password': password,
        'fullName': fullName,
        'role': role.apiName,
      },
      decode: (json) => AuthSessionDto.fromJson(json as Map<String, dynamic>),
    );
  }

  Future<void> logout({String? refreshToken}) async {
    try {
      await _api.post(
        ApiConstants.authLogout,
        body: refreshToken != null ? {'refreshToken': refreshToken} : null,
        decode: (_) => null,
      );
    } on DioException {
      // Logout is best-effort — tokens are cleared client-side regardless.
    }
  }

  Future<AuthUserModel> getMe() {
    return _api.get(
      ApiConstants.usersMe,
      decode: (json) => AuthUserModel.fromJson(json as Map<String, dynamic>),
    );
  }

  Future<AuthUserModel> updateProfile(Map<String, dynamic> body) {
    return _api.patch(
      ApiConstants.usersMe,
      body: body,
      decode: (json) => AuthUserModel.fromJson(json as Map<String, dynamic>),
    );
  }
}
