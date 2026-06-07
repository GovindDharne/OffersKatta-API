import 'dart:async';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:permission_handler/permission_handler.dart';

import '../constants/api_constants.dart';
import '../di/providers.dart';
import '../network/api_client.dart';

/// Owns Firebase Cloud Messaging on the device:
///   • initialises Firebase (silently no-op if google-services.json /
///     GoogleService-Info.plist isn't provisioned yet, so dev still runs)
///   • requests notification permission (iOS + Android 13+)
///   • fetches the FCM token and registers it with the API
///   • re-registers on token refresh
///   • streams foreground messages for the UI to surface as in-app banners
///   • deletes the token on logout so we stop receiving push for that device
///
/// All of this is best-effort — failures log a warning and the app keeps
/// working. We never block the auth flow on FCM.
class PushService {
  PushService(this._api);

  final ApiClient _api;

  bool _firebaseReady = false;
  bool _initialised = false;
  StreamSubscription<String>? _tokenSub;
  StreamSubscription<RemoteMessage>? _foregroundSub;

  /// Idempotent — safe to call repeatedly (e.g. after re-login on the same
  /// device). Returns the token we registered (or null if Firebase wasn't
  /// available).
  Future<String?> registerCurrentDevice() async {
    await _ensureFirebase();
    if (!_firebaseReady) return null;

    final allowed = await _ensurePermission();
    if (!allowed) {
      // User said no — don't bother fetching the token; they wouldn't see
      // notifications anyway. They can flip the OS toggle later and we'll
      // pick it up on the next app launch.
      return null;
    }

    final token = await FirebaseMessaging.instance.getToken();
    if (token == null) return null;

    await _postDevice(token);

    // Subscribe to refresh once; future refreshes auto-register.
    _tokenSub ??= FirebaseMessaging.instance.onTokenRefresh.listen((next) {
      _postDevice(next);
    });

    // Foreground messages — emitting on a stream lets the UI show in-app
    // toasts/banners. We keep handling out of this service so it stays
    // platform-agnostic.
    _foregroundSub ??= FirebaseMessaging.onMessage.listen(_messages.add);

    return token;
  }

  /// Best-effort cleanup on logout. The server-side device token row is also
  /// stripped server-side by /auth/logout if/when we wire that — for now we
  /// always DELETE explicitly.
  Future<void> unregisterCurrentDevice() async {
    if (!_firebaseReady) return;
    try {
      final token = await FirebaseMessaging.instance.getToken();
      if (token == null) return;
      await _api.delete<void>(ApiConstants.customersMeDevice(token));
      // Wipe the FCM identity so the OS can re-issue a fresh one if the
      // same physical device is used by a different user account.
      await FirebaseMessaging.instance.deleteToken();
    } catch (_) {
      // Best-effort; do not block logout.
    }
  }

  /// Stream of FCM messages received while the app is in the foreground.
  /// UI can subscribe to this to show snackbars / in-app banners.
  Stream<RemoteMessage> get foregroundMessages => _messages.stream;
  final _messages = StreamController<RemoteMessage>.broadcast();

  Future<void> _ensureFirebase() async {
    if (_initialised) return;
    _initialised = true;
    if (kIsWeb) return; // FCM web needs VAPID key — skip for now.
    try {
      await Firebase.initializeApp();
      _firebaseReady = true;
    } catch (e) {
      // No google-services.json yet — that's fine in dev, just log once.
      // The user can drop the file in later without code changes.
      // ignore: avoid_print
      print('[push] Firebase not initialised: $e — push disabled');
      _firebaseReady = false;
    }
  }

  Future<bool> _ensurePermission() async {
    final settings = await FirebaseMessaging.instance.requestPermission(
      alert: true, badge: true, sound: true,
    );
    if (settings.authorizationStatus == AuthorizationStatus.authorized ||
        settings.authorizationStatus == AuthorizationStatus.provisional) {
      return true;
    }
    // On Android 13+ the runtime permission is POST_NOTIFICATIONS — request it.
    final ph = await Permission.notification.request();
    return ph.isGranted || ph.isLimited;
  }

  Future<void> _postDevice(String fcmToken) async {
    try {
      await _api.post<void>(
        ApiConstants.customersMeDevices,
        body: {'fcmToken': fcmToken},
      );
    } catch (e) {
      // ignore: avoid_print
      print('[push] failed to register device token: $e');
    }
  }
}

final pushServiceProvider = Provider<PushService>(
  (ref) => PushService(ref.watch(apiClientProvider)),
);
