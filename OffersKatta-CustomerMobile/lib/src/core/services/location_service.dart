import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';

import '../constants/api_constants.dart';
import '../di/providers.dart';
import '../network/api_client.dart';

/// One-shot location capture + POST to /customers/me/location.
///
/// Why one-shot rather than streaming: marketing push targets the user's
/// "last known city/area", not their step-by-step movement. A best-effort
/// fix every app launch (capped at once/hour via a local timestamp) keeps
/// the radius targeting useful without burning battery.
///
/// All failure modes (services off, permission denied, timeout) are silently
/// swallowed — the customer's app still works, they just won't get
/// distance-targeted push until the next attempt.
class LocationService {
  LocationService(this._api);

  final ApiClient _api;
  DateTime? _lastSent;

  /// Best-effort: get the current position and POST it to the API.
  /// Returns the position if we managed to get + send one, else null.
  /// Throttled to once per hour so it doesn't hammer GPS on every nav.
  Future<Position?> captureAndSend({bool force = false}) async {
    final now = DateTime.now();
    if (!force && _lastSent != null && now.difference(_lastSent!).inMinutes < 60) {
      return null;
    }
    try {
      if (!await Geolocator.isLocationServiceEnabled()) return null;
      var perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied) {
        perm = await Geolocator.requestPermission();
      }
      if (perm == LocationPermission.denied || perm == LocationPermission.deniedForever) {
        return null;
      }
      final pos = await Geolocator.getCurrentPosition(
        // Balanced — accurate enough for radius targeting, doesn't drain
        // the battery the way `bestForNavigation` would.
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.medium,
          timeLimit: Duration(seconds: 10),
        ),
      );
      await _api.patch<void>(
        ApiConstants.customersMeLocation,
        body: {'latitude': pos.latitude, 'longitude': pos.longitude},
      );
      _lastSent = now;
      return pos;
    } catch (_) {
      // Geolocator throws if services off mid-flight, etc. Swallow.
      return null;
    }
  }
}

final locationServiceProvider = Provider<LocationService>(
  (ref) => LocationService(ref.watch(apiClientProvider)),
);
