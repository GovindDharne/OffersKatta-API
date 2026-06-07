import '../../../../core/error/exceptions.dart';
import '../../../../core/error/failure.dart';
import '../../../../core/network/token_storage.dart';
import '../../domain/entities/auth_user.dart';
import '../datasources/auth_local_datasource.dart';
import '../datasources/auth_remote_datasource.dart';

class AuthRepositoryImpl {
  AuthRepositoryImpl({
    required this.remote,
    required this.local,
    required this.tokens,
  });

  final AuthRemoteDataSource remote;
  final AuthLocalDataSource local;
  final TokenStorage tokens;

  /// Logs in, enforces the seller role gate, persists tokens + user.
  /// Throws AuthFailure if the role is not allowed for this app.
  Future<AuthUser> login(String email, String password) async {
    try {
      final session = await remote.login(email, password);
      final user = session.user.toEntity();
      if (!user.isAllowedForSeller) {
        // Don't store anything — caller may want to log them out cleanly anyway.
        throw AuthFailure(
          'This account (${user.role.replaceAll('_', ' ').toLowerCase()}) cannot use the '
          'OffersKatta seller app. Please use the consumer app instead.',
        );
      }
      await tokens.save(accessToken: session.accessToken, refreshToken: session.refreshToken);
      await local.saveUser(session.user);
      return user;
    } on ApiException catch (e) {
      throw _map(e);
    }
  }

  /// Returns the cached user if any. Use this on app start.
  Future<AuthUser?> cachedUser() async {
    final model = await local.readUser();
    return model?.toEntity();
  }

  /// Hits /users/me to validate the cached token and refresh user info.
  Future<AuthUser?> verifySession() async {
    try {
      final access = await tokens.readAccess();
      if (access == null) return null;
      final fresh = await remote.me();
      await local.saveUser(fresh);
      final user = fresh.toEntity();
      if (!user.isAllowedForSeller) {
        await logout();
        return null;
      }
      return user;
    } on UnauthorizedException {
      await logout();
      return null;
    } on ApiException {
      // Network error etc. — fall back to cached so the UI still works offline.
      return cachedUser();
    }
  }

  Future<void> logout() async {
    try {
      await remote.logout();
    } catch (_) {/* ignore — clear locally anyway */}
    await tokens.clear();
    await local.clear();
  }

  Failure _map(ApiException e) {
    if (e is NetworkException) return NetworkFailure(e.message);
    if (e is UnauthorizedException) return AuthFailure('Invalid email or password');
    return ServerFailure(e.message, statusCode: e.statusCode, code: e.code);
  }
}
