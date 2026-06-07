import 'package:flutter_test/flutter_test.dart';
import 'package:offerskatta_customer/src/core/error/exceptions.dart';
import 'package:offerskatta_customer/src/core/error/failure.dart';
import 'package:offerskatta_customer/src/core/network/token_storage.dart';
import 'package:offerskatta_customer/src/features/auth/data/datasources/auth_local_datasource.dart';
import 'package:offerskatta_customer/src/features/auth/data/datasources/auth_remote_datasource.dart';
import 'package:offerskatta_customer/src/features/auth/data/models/auth_user_model.dart';
import 'package:offerskatta_customer/src/features/auth/data/repositories/auth_repository_impl.dart';
import 'package:offerskatta_customer/src/features/auth/domain/entities/auth_user.dart';

class _FakeRemote implements AuthRemoteDataSource {
  _FakeRemote({this.loginResult, this.shouldThrow});
  final AuthSessionDto? loginResult;
  final ApiException? shouldThrow;
  bool loginCalled = false;
  bool logoutCalled = false;

  @override
  Future<AuthSessionDto> login({required String email, required String password}) async {
    loginCalled = true;
    if (shouldThrow != null) throw shouldThrow!;
    return loginResult!;
  }

  @override
  Future<AuthSessionDto> register({
    required String email,
    required String password,
    required String fullName,
    required UserRole role,
  }) async {
    if (shouldThrow != null) throw shouldThrow!;
    return loginResult!;
  }

  @override
  Future<void> logout({String? refreshToken}) async {
    logoutCalled = true;
  }

  @override
  Future<AuthUserModel> getMe() async => loginResult!.user;

  @override
  Future<AuthUserModel> updateProfile(Map<String, dynamic> body) async => loginResult!.user;
}

class _MemoryTokens implements TokenStorage {
  String? access;
  String? refresh;

  @override
  Future<void> clear() async { access = null; refresh = null; }

  @override
  Future<String?> readAccess() async => access;

  @override
  Future<String?> readRefresh() async => refresh;

  @override
  Future<void> save({required String accessToken, required String refreshToken}) async {
    access = accessToken;
    refresh = refreshToken;
  }
}

class _MemoryLocal implements AuthLocalDataSource {
  AuthUserModel? cached;

  @override
  Future<void> clear() async { cached = null; }

  @override
  Future<AuthUserModel?> readUser() async => cached;

  @override
  Future<void> saveUser(AuthUserModel user) async { cached = user; }
}

AuthSessionDto _session({String email = 'jane@example.com'}) => AuthSessionDto(
      accessToken: 'access-token-1',
      refreshToken: 'refresh-token-1',
      expiresIn: 900,
      user: AuthUserModel(id: 'u1', role: UserRole.customer, email: email, fullName: 'Jane'),
    );

void main() {
  group('AuthRepositoryImpl', () {
    test('login saves tokens + caches the user', () async {
      final remote = _FakeRemote(loginResult: _session());
      final tokens = _MemoryTokens();
      final local = _MemoryLocal();
      final repo = AuthRepositoryImpl(remote: remote, local: local, tokens: tokens);

      final session = await repo.login(email: 'jane@example.com', password: 'Secret123!');

      expect(remote.loginCalled, isTrue);
      expect(session.accessToken, 'access-token-1');
      expect(session.user.email, 'jane@example.com');
      expect(tokens.access, 'access-token-1');
      expect(tokens.refresh, 'refresh-token-1');
      expect(local.cached?.email, 'jane@example.com');
    });

    test('login maps a 401 ApiException to AuthFailure', () async {
      final remote = _FakeRemote(shouldThrow: UnauthorizedException('Invalid credentials'));
      final repo = AuthRepositoryImpl(remote: remote, local: _MemoryLocal(), tokens: _MemoryTokens());

      await expectLater(
        repo.login(email: 'x', password: 'y'),
        throwsA(isA<AuthFailure>()),
      );
    });

    test('login maps a NetworkException to NetworkFailure', () async {
      final remote = _FakeRemote(shouldThrow: NetworkException('offline'));
      final repo = AuthRepositoryImpl(remote: remote, local: _MemoryLocal(), tokens: _MemoryTokens());

      await expectLater(
        repo.login(email: 'x', password: 'y'),
        throwsA(isA<NetworkFailure>()),
      );
    });

    test('bootstrap returns null when there is no refresh token', () async {
      final repo = AuthRepositoryImpl(
        remote: _FakeRemote(loginResult: _session()),
        local: _MemoryLocal(),
        tokens: _MemoryTokens(),
      );
      expect(await repo.bootstrap(), isNull);
    });

    test('bootstrap returns the cached user when tokens exist', () async {
      final tokens = _MemoryTokens()..access = 'a'..refresh = 'r';
      final local = _MemoryLocal()
        ..cached = AuthUserModel(id: 'u1', role: UserRole.customer, email: 'jane@example.com');
      final repo = AuthRepositoryImpl(remote: _FakeRemote(loginResult: _session()), local: local, tokens: tokens);

      final user = await repo.bootstrap();
      expect(user, isNotNull);
      expect(user!.email, 'jane@example.com');
    });

    test('logout clears tokens + cache and notifies the remote', () async {
      final tokens = _MemoryTokens()..access = 'a'..refresh = 'r';
      final local = _MemoryLocal()
        ..cached = AuthUserModel(id: 'u1', role: UserRole.customer, email: 'jane@example.com');
      final remote = _FakeRemote(loginResult: _session());
      final repo = AuthRepositoryImpl(remote: remote, local: local, tokens: tokens);

      await repo.logout();

      expect(remote.logoutCalled, isTrue);
      expect(tokens.access, isNull);
      expect(tokens.refresh, isNull);
      expect(local.cached, isNull);
    });
  });
}
