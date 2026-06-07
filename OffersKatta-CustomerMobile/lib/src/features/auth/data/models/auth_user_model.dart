import '../../domain/entities/auth_user.dart';

class AuthUserModel {
  const AuthUserModel({
    required this.id,
    required this.role,
    this.email,
    this.fullName,
    this.phone,
    this.avatarUrl,
  });

  factory AuthUserModel.fromJson(Map<String, dynamic> json) => AuthUserModel(
        id: json['id'] as String,
        role: UserRole.fromString(json['role'] as String? ?? 'CUSTOMER'),
        email: json['email'] as String?,
        fullName: json['fullName'] as String?,
        phone: json['phone'] as String?,
        avatarUrl: json['avatarUrl'] as String?,
      );

  final String id;
  final UserRole role;
  final String? email;
  final String? fullName;
  final String? phone;
  final String? avatarUrl;

  AuthUser toEntity() => AuthUser(
        id: id,
        role: role,
        email: email,
        fullName: fullName,
        phone: phone,
        avatarUrl: avatarUrl,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'role': role.apiName,
        if (email != null) 'email': email,
        if (fullName != null) 'fullName': fullName,
        if (phone != null) 'phone': phone,
        if (avatarUrl != null) 'avatarUrl': avatarUrl,
      };
}
