import '../../domain/entities/auth_user.dart';

class AuthUserModel {
  AuthUserModel({
    required this.id,
    required this.email,
    required this.role,
    this.fullName,
    this.phone,
  });

  factory AuthUserModel.fromJson(Map<String, dynamic> j) => AuthUserModel(
        id: j['id'] as String,
        email: j['email'] as String,
        role: j['role'] as String,
        fullName: j['fullName'] as String?,
        phone: j['phone'] as String?,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'email': email,
        'role': role,
        'fullName': fullName,
        'phone': phone,
      };

  final String id;
  final String email;
  final String role;
  final String? fullName;
  final String? phone;

  AuthUser toEntity() => AuthUser(id: id, email: email, role: role, fullName: fullName, phone: phone);
}

/// Wraps the /auth/login response shape: { user, accessToken, refreshToken }.
class AuthSessionDto {
  AuthSessionDto({required this.user, required this.accessToken, required this.refreshToken});
  final AuthUserModel user;
  final String accessToken;
  final String refreshToken;

  factory AuthSessionDto.fromJson(Map<String, dynamic> j) => AuthSessionDto(
        user: AuthUserModel.fromJson(j['user'] as Map<String, dynamic>),
        accessToken: j['accessToken'] as String,
        refreshToken: j['refreshToken'] as String,
      );
}
