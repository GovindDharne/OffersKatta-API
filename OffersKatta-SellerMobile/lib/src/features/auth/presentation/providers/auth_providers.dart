import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/di/providers.dart';
import '../../data/datasources/auth_local_datasource.dart';
import '../../data/datasources/auth_remote_datasource.dart';
import '../../data/repositories/auth_repository_impl.dart';
import '../../domain/entities/auth_user.dart';

final authRemoteProvider = Provider<AuthRemoteDataSource>(
  (ref) => AuthRemoteDataSource(ref.watch(apiClientProvider)),
);

final authLocalProvider = Provider<AuthLocalDataSource>(
  (ref) => AuthLocalDataSource(ref.watch(secureStorageProvider)),
);

final authRepositoryProvider = Provider<AuthRepositoryImpl>(
  (ref) => AuthRepositoryImpl(
    remote: ref.watch(authRemoteProvider),
    local: ref.watch(authLocalProvider),
    tokens: ref.watch(tokenStorageProvider),
  ),
);

/// One source of truth for the current user. `loading` while we boot,
/// `data(null)` when logged out, `data(user)` when logged in.
class AuthController extends StateNotifier<AsyncValue<AuthUser?>> {
  AuthController(this._repo) : super(const AsyncValue.loading()) {
    _bootstrap();
  }

  final AuthRepositoryImpl _repo;

  Future<void> _bootstrap() async {
    try {
      final user = await _repo.verifySession();
      state = AsyncValue.data(user);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  Future<AuthUser> login(String email, String password) async {
    state = const AsyncValue.loading();
    try {
      final user = await _repo.login(email, password);
      state = AsyncValue.data(user);
      return user;
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      rethrow;
    }
  }

  Future<void> logout() async {
    await _repo.logout();
    state = const AsyncValue.data(null);
  }
}

final authControllerProvider =
    StateNotifierProvider<AuthController, AsyncValue<AuthUser?>>(
  (ref) => AuthController(ref.watch(authRepositoryProvider)),
);
