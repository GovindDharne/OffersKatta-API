import '../entities/auth_tokens.dart';
import '../entities/auth_user.dart';
import '../repositories/auth_repository.dart';

class LoginUseCase {
  LoginUseCase(this._repo);
  final AuthRepository _repo;

  Future<AuthSession> call({required String email, required String password}) =>
      _repo.login(email: email, password: password);
}

class RegisterUseCase {
  RegisterUseCase(this._repo);
  final AuthRepository _repo;

  Future<AuthSession> call({
    required String email,
    required String password,
    required String fullName,
    UserRole role = UserRole.customer,
  }) =>
      _repo.register(email: email, password: password, fullName: fullName, role: role);
}

class LogoutUseCase {
  LogoutUseCase(this._repo);
  final AuthRepository _repo;
  Future<void> call() => _repo.logout();
}

class BootstrapSessionUseCase {
  BootstrapSessionUseCase(this._repo);
  final AuthRepository _repo;
  Future<AuthUser?> call() => _repo.bootstrap();
}

class UpdateProfileUseCase {
  UpdateProfileUseCase(this._repo);
  final AuthRepository _repo;

  Future<AuthUser> call({
    String? fullName,
    String? city,
    String? state,
    String? country,
    double? latitude,
    double? longitude,
    String? fcmToken,
  }) =>
      _repo.updateProfile(
        fullName: fullName,
        city: city,
        state: state,
        country: country,
        latitude: latitude,
        longitude: longitude,
        fcmToken: fcmToken,
      );
}
