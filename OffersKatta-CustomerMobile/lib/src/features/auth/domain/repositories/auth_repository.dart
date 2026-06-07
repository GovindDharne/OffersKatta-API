import '../entities/auth_tokens.dart';
import '../entities/auth_user.dart';

abstract class AuthRepository {
  /// Returns the cached user (if a valid session is on disk) without hitting the network.
  Future<AuthUser?> bootstrap();

  Future<AuthSession> login({required String email, required String password});

  Future<AuthSession> register({
    required String email,
    required String password,
    required String fullName,
    UserRole role = UserRole.customer,
  });

  Future<void> logout();

  Future<AuthUser> getMe();

  Future<AuthUser> updateProfile({
    String? fullName,
    String? city,
    String? state,
    String? country,
    double? latitude,
    double? longitude,
    String? fcmToken,
  });
}
