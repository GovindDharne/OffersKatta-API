import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Persists JWT bearer + refresh tokens on the OS keystore.
///
/// Reads are memoized in-process so that concurrent requests don't all hit the
/// platform channel at once — flutter_secure_storage on Android can deadlock
/// under parallel reads (multiple Riverpod providers fetching at the same time
/// would otherwise each open the keystore). The in-flight Future is also
/// shared so simultaneous first-time readers don't race each other.
class TokenStorage {
  TokenStorage(this._storage);

  static const _kAccess = 'offerskatta_access';
  static const _kRefresh = 'offerskatta_refresh';

  final FlutterSecureStorage _storage;

  String? _accessCache;
  String? _refreshCache;
  bool _accessLoaded = false;
  bool _refreshLoaded = false;
  Future<String?>? _accessInFlight;
  Future<String?>? _refreshInFlight;

  Future<String?> readAccess() {
    if (_accessLoaded) return Future.value(_accessCache);
    return _accessInFlight ??= _storage.read(key: _kAccess).then((v) {
      _accessCache = v;
      _accessLoaded = true;
      _accessInFlight = null;
      return v;
    });
  }

  Future<String?> readRefresh() {
    if (_refreshLoaded) return Future.value(_refreshCache);
    return _refreshInFlight ??= _storage.read(key: _kRefresh).then((v) {
      _refreshCache = v;
      _refreshLoaded = true;
      _refreshInFlight = null;
      return v;
    });
  }

  Future<void> save({required String accessToken, required String refreshToken}) async {
    await _storage.write(key: _kAccess, value: accessToken);
    await _storage.write(key: _kRefresh, value: refreshToken);
    _accessCache = accessToken;
    _refreshCache = refreshToken;
    _accessLoaded = true;
    _refreshLoaded = true;
  }

  Future<void> clear() async {
    await _storage.delete(key: _kAccess);
    await _storage.delete(key: _kRefresh);
    _accessCache = null;
    _refreshCache = null;
    _accessLoaded = true;
    _refreshLoaded = true;
  }
}
