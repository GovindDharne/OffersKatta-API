import 'auth_user.dart';

class AuthSession {
  const AuthSession({
    required this.accessToken,
    required this.refreshToken,
    required this.user,
    required this.expiresIn,
  });

  final String accessToken;
  final String refreshToken;
  final AuthUser user;
  final int expiresIn;
}
