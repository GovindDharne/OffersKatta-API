import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/di/providers.dart';
import '../../../../core/services/location_service.dart';
import '../../../../core/services/push_service.dart';
import '../../data/datasources/auth_local_datasource.dart';
import '../../data/datasources/auth_remote_datasource.dart';
import '../../data/repositories/auth_repository_impl.dart';
import '../../domain/entities/auth_user.dart';
import '../../domain/repositories/auth_repository.dart';
import '../../domain/usecases/auth_usecases.dart';

// Data sources
final authRemoteDataSourceProvider = Provider<AuthRemoteDataSource>(
  (ref) => AuthRemoteDataSource(ref.watch(apiClientProvider)),
);

final authLocalDataSourceProvider = Provider<AuthLocalDataSource>(
  (ref) => AuthLocalDataSource(ref.watch(secureStorageProvider)),
);

// Repository
final authRepositoryProvider = Provider<AuthRepository>(
  (ref) => AuthRepositoryImpl(
    remote: ref.watch(authRemoteDataSourceProvider),
    local: ref.watch(authLocalDataSourceProvider),
    tokens: ref.watch(tokenStorageProvider),
  ),
);

// Use cases
final loginUseCaseProvider = Provider((ref) => LoginUseCase(ref.watch(authRepositoryProvider)));
final registerUseCaseProvider = Provider((ref) => RegisterUseCase(ref.watch(authRepositoryProvider)));
final logoutUseCaseProvider = Provider((ref) => LogoutUseCase(ref.watch(authRepositoryProvider)));
final bootstrapUseCaseProvider = Provider((ref) => BootstrapSessionUseCase(ref.watch(authRepositoryProvider)));
final updateProfileUseCaseProvider = Provider((ref) => UpdateProfileUseCase(ref.watch(authRepositoryProvider)));

/// Holds the auth lifecycle: bootstrap → unauthenticated/authenticated.
class AuthState {
  const AuthState._({
    required this.isBootstrapping,
    required this.user,
    this.error,
  });

  const AuthState.initial() : this._(isBootstrapping: true, user: null);
  const AuthState.unauthenticated({String? error}) : this._(isBootstrapping: false, user: null, error: error);
  const AuthState.authenticated(AuthUser user) : this._(isBootstrapping: false, user: user);

  final bool isBootstrapping;
  final AuthUser? user;
  final String? error;

  bool get isAuthenticated => user != null;
}

class AuthController extends StateNotifier<AuthState> {
  AuthController(this._ref) : super(const AuthState.initial()) {
    _bootstrap();
  }

  final Ref _ref;

  Future<void> _bootstrap() async {
    try {
      final user = await _ref.read(bootstrapUseCaseProvider)();
      state = user != null ? AuthState.authenticated(user) : const AuthState.unauthenticated();
      if (user != null) _onAuthenticated();
    } catch (_) {
      state = const AuthState.unauthenticated();
    }
  }

  Future<AuthUser> login({required String email, required String password}) async {
    final session = await _ref.read(loginUseCaseProvider)(email: email, password: password);
    state = AuthState.authenticated(session.user);
    _onAuthenticated();
    return session.user;
  }

  Future<AuthUser> register({
    required String email,
    required String password,
    required String fullName,
    UserRole role = UserRole.customer,
  }) async {
    final session = await _ref.read(registerUseCaseProvider)(
      email: email,
      password: password,
      fullName: fullName,
      role: role,
    );
    state = AuthState.authenticated(session.user);
    _onAuthenticated();
    return session.user;
  }

  Future<void> logout() async {
    // Best-effort device unregister before we drop the token, so the API
    // call still has a bearer.
    try {
      await _ref.read(pushServiceProvider).unregisterCurrentDevice();
    } catch (_) {/* swallow */}
    await _ref.read(logoutUseCaseProvider)();
    state = const AuthState.unauthenticated();
  }

  /// Side-effects to fire whenever the user becomes authenticated:
  ///   • Register this device's FCM token so push targeting can reach them.
  ///   • Refresh last-known location for radius-based push.
  /// Both run in parallel, neither blocks the UI — they fail silently.
  void _onAuthenticated() {
    final ref = _ref;
    // Fire-and-forget; the controller doesn't await these so the login
    // flow returns immediately and the splash → home transition is instant.
    Future.microtask(() async {
      try { await ref.read(pushServiceProvider).registerCurrentDevice(); } catch (_) {}
      try { await ref.read(locationServiceProvider).captureAndSend(); } catch (_) {}
    });
  }
}

final authControllerProvider = StateNotifierProvider<AuthController, AuthState>(
  (ref) => AuthController(ref),
);

// Convenience selectors
final currentUserProvider = Provider<AuthUser?>((ref) => ref.watch(authControllerProvider).user);
final isAuthenticatedProvider = Provider<bool>((ref) => ref.watch(authControllerProvider).isAuthenticated);
