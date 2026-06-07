import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../models/auth_user_model.dart';

class AuthLocalDataSource {
  AuthLocalDataSource(this._storage);

  static const _kUser = 'offerskatta_user';
  final FlutterSecureStorage _storage;

  Future<AuthUserModel?> readUser() async {
    final raw = await _storage.read(key: _kUser);
    if (raw == null) return null;
    return AuthUserModel.fromJson(jsonDecode(raw) as Map<String, dynamic>);
  }

  Future<void> saveUser(AuthUserModel user) {
    return _storage.write(key: _kUser, value: jsonEncode(user.toJson()));
  }

  Future<void> clear() => _storage.delete(key: _kUser);
}
