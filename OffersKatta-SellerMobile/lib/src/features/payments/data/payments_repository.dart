import '../../../core/error/exceptions.dart';
import '../../../core/error/failure.dart';
import '../../../core/network/api_client.dart';

/// One Razorpay-able boost tier as returned by `GET /payments/boost/options`.
class BoostOption {
  const BoostOption({required this.days, required this.price, required this.currency});
  final int days;
  final num price;       // rupees (whole currency unit)
  final String currency; // 'INR'

  factory BoostOption.fromJson(Map<String, dynamic> j) => BoostOption(
        days: (j['days'] as num).toInt(),
        price: j['price'] as num,
        currency: j['currency'] as String? ?? 'INR',
      );
}

/// The `/payments/config` envelope: tells us if Razorpay is enabled + the
/// public key id to hand to the Checkout SDK.
class PaymentConfig {
  const PaymentConfig({required this.enabled, this.keyId});
  final bool enabled;
  final String? keyId;

  factory PaymentConfig.fromJson(Map<String, dynamic> j) => PaymentConfig(
        enabled: j['enabled'] as bool? ?? false,
        keyId: j['keyId'] as String?,
      );
}

/// What `POST /payments/boost/create-order` returns: a Razorpay order id
/// + the amount (in paise) we should hand to Checkout.
class BoostOrder {
  const BoostOrder({required this.id, required this.amount, required this.currency});
  final String id;
  final int amount;      // paise — pass straight through to Razorpay
  final String currency;

  factory BoostOrder.fromJson(Map<String, dynamic> j) {
    final order = j['order'] as Map<String, dynamic>;
    return BoostOrder(
      id: order['id'] as String,
      amount: (order['amount'] as num).toInt(),
      currency: order['currency'] as String? ?? 'INR',
    );
  }
}

class PaymentsRepository {
  PaymentsRepository(this._api);
  final ApiClient _api;

  Future<PaymentConfig> config() async {
    try {
      return await _api.get<PaymentConfig>(
        '/payments/config',
        decode: (json) => PaymentConfig.fromJson(json as Map<String, dynamic>),
      );
    } on ApiException catch (e) {
      throw _map(e);
    }
  }

  Future<List<BoostOption>> boostOptions() async {
    try {
      return await _api.get<List<BoostOption>>(
        '/payments/boost/options',
        decode: (json) => (json as List<dynamic>)
            .whereType<Map<String, dynamic>>()
            .map(BoostOption.fromJson)
            .toList(growable: false),
      );
    } on ApiException catch (e) {
      throw _map(e);
    }
  }

  Future<BoostOrder> createBoostOrder({required String offerId, required int days}) async {
    try {
      return await _api.post<BoostOrder>(
        '/payments/boost/create-order',
        body: {'offerId': offerId, 'days': days},
        decode: (json) => BoostOrder.fromJson(json as Map<String, dynamic>),
      );
    } on ApiException catch (e) {
      throw _map(e);
    }
  }

  Future<void> verify({
    required String razorpayOrderId,
    required String razorpayPaymentId,
    required String razorpaySignature,
  }) async {
    try {
      await _api.post<void>(
        '/payments/verify',
        body: {
          'razorpayOrderId': razorpayOrderId,
          'razorpayPaymentId': razorpayPaymentId,
          'razorpaySignature': razorpaySignature,
        },
      );
    } on ApiException catch (e) {
      throw _map(e);
    }
  }

  Failure _map(ApiException e) {
    if (e is NetworkException) return NetworkFailure(e.message);
    if (e is UnauthorizedException) return AuthFailure(e.message);
    return ServerFailure(e.message, statusCode: e.statusCode, code: e.code);
  }
}
