class ApiConstants {
  ApiConstants._();

  /// Override at run/build time via:
  ///   flutter run --dart-define=API_BASE_URL=http://<host>/api
  /// Default points at the dev machine's LAN IP so a physical phone or
  /// Android emulator can reach it without needing the override. Update this
  /// when the dev machine's IP changes (or always pass --dart-define).
  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://192.168.0.155/api',
  );

  static const Duration connectTimeout = Duration(seconds: 15);
  static const Duration receiveTimeout = Duration(seconds: 20);

  // Endpoints
  static const String authLogin     = '/auth/login';
  static const String authRegister  = '/auth/register';
  static const String authRefresh   = '/auth/refresh';
  static const String authLogout    = '/auth/logout';
  static const String authOtpReq    = '/auth/otp/request';
  static const String authOtpVerify = '/auth/otp/verify';

  static const String usersMe       = '/users/me';

  static const String categories    = '/categories';
  static const String banks         = '/banks';
  static const String offers        = '/offers';
  static const String offersNearby  = '/offers/nearby';
  static String offerById(String id) => '/offers/$id';

  static const String favorites     = '/favorites';
  static String favoriteById(String id) => '/favorites/$id';

  static String issueRedemption(String offerId) => '/redemptions/offer/$offerId';
  static String cancelRedemption(String qr) => '/redemptions/$qr/cancel';
  static const String myRedemptions = '/redemptions/me';

  static const String notifications = '/notifications';
  static const String notificationsUnread = '/notifications/unread-count';
  static const String notificationsReadAll = '/notifications/read-all';
  static String notificationRead(String id) => '/notifications/$id/read';

  // Customer-only: location + push device + notify-prefs
  static const String customersMe            = '/customers/me';
  static const String customersMeLocation    = '/customers/me/location';
  static const String customersMeDevices     = '/customers/me/devices';
  static String       customersMeDevice(String token) => '/customers/me/devices/$token';
  static const String customersMePreferences = '/customers/me/preferences';

  // Brand follow
  static String brandFollow(String id)       => '/brands/$id/follow';
  static String brandFollowStatus(String id) => '/brands/$id/follow/status';
  static const String brandsMeFollows        = '/brands/me/follows';
}
