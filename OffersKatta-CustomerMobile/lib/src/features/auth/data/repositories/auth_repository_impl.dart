import '../../../../core/error/exceptions.dart';
import '../../../../core/error/failure.dart';
import '../../../../core/network/token_storage.dart';
import '../../domain/entities/auth_tokens.dart';
import '../../domain/entities/auth_user.dart';
import '../../domain/repositories/auth_repository.dart';
import '../datasources/auth_local_datasource.dart';
import '../datasources/auth_remote_datasource.dart';

class AuthRepositoryImpl implements AuthRepository {
  AuthRepositoryImpl({
    required AuthRemoteDataSource remote,
    required AuthLocalDataSource local,
    required TokenStorage tokens,
  })  : _remote = remote,
        _local = local,
        _tokens = tokens;

  final AuthRemoteDataSource _remote;
  final AuthLocalDataSource _local;
  final TokenStorage _tokens;

  @override
  Future<AuthUser?> bootstrap() async {
    final access = await _tokens.readAccess();
    final refresh = await _tokens.readRefresh();
    if (access == null || refresh == null) return null;
    final cached = await _local.readUser();
    return cached?.toEntity();
  }

  @override
  Future<AuthSession> login({required String email, required String password}) async {
    try {
      final dto = await _remote.login(email: email, password: password);
      await _tokens.save(accessToken: dto.accessToken, refreshToken: dto.refreshToken);
      await _local.saveUser(dto.user);
      return AuthSession(
        accessToken: dto.accessToken,
        refreshToken: dto.refreshToken,
        user: dto.user.toEntity(),
        expiresIn: dto.expiresIn,
      );
    } on ApiException catch (e) {
      throw _mapApiException(e);
    }
  }

  @override
  Future<AuthSession> register({
    required String email,
    required String password,
    required String fullName,
    UserRole role = UserRole.customer,
  }) async {
    try {
      final dto = await _remote.register(
        email: email,
        password: password,
        fullName: fullName,
        role: role,
      );
      await _tokens.save(accessToken: dto.accessToken, refreshToken: dto.refreshToken);
      await _local.saveUser(dto.user);
      return AuthSession(
        accessToken: dto.accessToken,
        refreshToken: dto.refreshToken,
        user: dto.user.toEntity(),
        expiresIn: dto.expiresIn,
      );
    } on ApiException catch (e) {
      throw _mapApiException(e);
    }
  }

  @override
  Future<void> logout() async {
    final refresh = await _tokens.readRefresh();
    await _remote.logout(refreshToken: refresh);
    await _tokens.clear();
    await _local.clear();
  }

  @override
  Future<AuthUser> getMe() async {
    try {
      final model = await _remote.getMe();
      await _local.saveUser(model);
      return model.toEntity();
    } on ApiException catch (e) {
      throw _mapApiException(e);
    }
  }

  @override
  Future<AuthUser> updateProfile({
    String? fullName,
    String? city,
    String? state,
    String? country,
    double? latitude,
    double? longitude,
    String? fcmToken,
  }) async {
    final body = <String, dynamic>{
      if (fullName != null) 'fullName': fullName,
      if (city != null) 'city': city,
      if (state != null) 'state': state,
      if (country != null) 'country': country,
      if (latitude != null) 'latitude': latitude,
      if (longitude != null) 'longitude': longitude,
      if (fcmToken != null) 'fcmToken': fcmToken,
    };
    try {
      final updated = await _remote.updateProfile(body);
      await _local.saveUser(updated);
      return updated.toEntity();
    } on ApiException catch (e) {
      throw _mapApiException(e);
    }
  }

  Failure _mapApiException(ApiException e) {
    if (e is UnauthorizedException) return AuthFailure(e.message);
    if (e is NetworkException) return NetworkFailure(e.message);
    if (e.statusCode != null && e.statusCode! >= 400 && e.statusCode! < 500) {
      return ValidationFailure(e.message);
    }
    return ServerFailure(e.message, statusCode: e.statusCode, code: e.code);
  }
}
