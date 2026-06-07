import 'package:flutter/foundation.dart' show kIsWeb;

class ApiConstants {
  ApiConstants._();

  /// Hard override (e.g. for staging/prod builds):
  ///   flutter run --dart-define=API_BASE_URL=https://api.offerskatta.com/api
  static const String _override = String.fromEnvironment('API_BASE_URL');

  /// Browser (Flutter web): `localhost` on the host machine.
  /// Mobile dev fallback: the dev machine's LAN IP (so a physical phone or
  /// emulator can reach it without needing `--dart-define`). When this IP
  /// changes (new Wi-Fi / DHCP), either update this line or pass the override:
  ///   flutter run --dart-define=API_BASE_URL=http://<your-LAN-IP>/api
  /// Android emulator users who prefer `10.0.2.2` can also use the override.
  static String get baseUrl {
    if (_override.isNotEmpty) return _override;
    if (kIsWeb) return 'http://localhost/api';
    return 'http://192.168.0.155/api';
  }

  /// URL of the management panel, used by "Manage on the website" links
  /// (subscription, offer boost — which need Razorpay Checkout).
  static const String panelUrl = String.fromEnvironment(
    'PANEL_URL',
    defaultValue: 'http://admin.offerskatta.com',
  );

  static const Duration connectTimeout = Duration(seconds: 15);
  static const Duration receiveTimeout = Duration(seconds: 20);

  // Auth
  static const String authLogin    = '/auth/login';
  static const String authRefresh  = '/auth/refresh';
  static const String authLogout   = '/auth/logout';
  static const String usersMe      = '/users/me';

  // Catalog
  static const String categories   = '/categories';
  static const String banks        = '/banks';

  // Brands / branches
  static const String brandsMine   = '/brands/mine';
  static const String brands       = '/brands';
  static String brandById(String id) => '/brands/$id';

  static const String branches     = '/branches';
  static String branchById(String id) => '/branches/$id';

  // Offers
  static const String offers       = '/offers';
  static String offerById(String id) => '/offers/$id';

  // Push — "notify nearby customers about this offer"
  static String pushOffer(String offerId) => '/push/offer/$offerId';
  static String pushJob(String jobId) => '/push/jobs/$jobId';

  // Uploads
  static const String uploadFile   = '/uploads/file';

  // Subscriptions
  static const String subscriptionPlans = '/subscriptions/plans';
  static String subscriptionForBrand(String brandId) => '/subscriptions/$brandId';
  static const String subscriptionChange = '/subscriptions/change';
  static String subscriptionCancel(String brandId) => '/subscriptions/$brandId/cancel';

  // Payments
  static const String paymentsConfig = '/payments/config';
  static const String paymentsCreateOrder = '/payments/create-order';
  static const String paymentsVerify = '/payments/verify';
  static String paymentsForBrand(String brandId) => '/payments/brand/$brandId';

  // Enterprise sales leads
  static const String enterpriseLeads = '/enterprise/leads';

  // Redemptions (seller-side: confirm or cancel a customer's QR)
  static String redemptionConfirm(String qr) => '/redemptions/$qr/confirm';
  static String redemptionCancel(String qr) => '/redemptions/$qr/cancel';
  static String redemptionsForBranch(String branchId) => '/redemptions/branch/$branchId';
}
