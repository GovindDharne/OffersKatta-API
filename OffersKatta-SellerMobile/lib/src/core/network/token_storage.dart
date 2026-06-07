import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Persists JWT bearer + refresh tokens on the OS keystore.
/// Tokens are cached in memory after the first read so that the KeyStore
/// (which is slow on Android, especially emulators) is only hit once per
/// session rather than on every API request.
class TokenStorage {
  TokenStorage(this._storage);

  static const _kAccess = 'offerskatta_seller_access';
  static const _kRefresh = 'offerskatta_seller_refresh';

  final FlutterSecureStorage _storage;

  String? _cachedAccess;
  String? _cachedRefresh;

  Future<String?> readAccess() async {
    _cachedAccess ??= await _storage.read(key: _kAccess);
    return _cachedAccess;
  }

  Future<String?> readRefresh() async {
    _cachedRefresh ??= await _storage.read(key: _kRefresh);
    return _cachedRefresh;
  }

  Future<void> save({required String accessToken, required String refreshToken}) async {
    _cachedAccess = accessToken;
    _cachedRefresh = refreshToken;
    await _storage.write(key: _kAccess, value: accessToken);
    await _storage.write(key: _kRefresh, value: refreshToken);
  }

  Future<void> clear() async {
    _cachedAccess = null;
    _cachedRefresh = null;
    await _storage.delete(key: _kAccess);
    await _storage.delete(key: _kRefresh);
  }
}
