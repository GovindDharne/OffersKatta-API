import '../../../../core/constants/api_constants.dart';
import '../../../../core/network/api_client.dart';
import '../models/subscription_models.dart';

class SubscriptionRemoteDataSource {
  SubscriptionRemoteDataSource(this._api);
  final ApiClient _api;

  Future<List<Plan>> getPlans() async {
    return _api.get<List<Plan>>(
      ApiConstants.subscriptionPlans,
      decode: (json) => (json as List<dynamic>)
          .map((e) => Plan.fromJson(e as Map<String, dynamic>))
          .toList(growable: false),
    );
  }

  Future<PaymentsConfig> getPaymentsConfig() {
    return _api.get<PaymentsConfig>(
      ApiConstants.paymentsConfig,
      decode: (json) => PaymentsConfig.fromJson(json as Map<String, dynamic>),
    );
  }

  Future<SubscriptionInfo?> getForBrand(String brandId) {
    return _api.get<SubscriptionInfo?>(
      ApiConstants.subscriptionForBrand(brandId),
      decode: (json) => json == null
          ? null
          : SubscriptionInfo.fromJson(json as Map<String, dynamic>),
    );
  }

  Future<List<PaymentRecord>> paymentsForBrand(String brandId) {
    return _api.get<List<PaymentRecord>>(
      ApiConstants.paymentsForBrand(brandId),
      decode: (json) => ((json as List<dynamic>?) ?? const [])
          .map((e) => PaymentRecord.fromJson(e as Map<String, dynamic>))
          .toList(growable: false),
    );
  }

  Future<ChangePlanResult> changePlan({
    required String brandId,
    required PlanName plan,
    required BillingInterval billingInterval,
  }) {
    return _api.post<ChangePlanResult>(
      ApiConstants.subscriptionChange,
      body: {
        'brandId': brandId,
        'plan': planNameToApi(plan),
        'billingInterval': billingIntervalToApi(billingInterval),
      },
      decode: (json) => ChangePlanResult.fromJson(json as Map<String, dynamic>),
    );
  }

  Future<CreateOrderResult> createOrder({
    required String brandId,
    required num amount,
    String? description,
  }) {
    return _api.post<CreateOrderResult>(
      ApiConstants.paymentsCreateOrder,
      body: {
        'brandId': brandId,
        'amount': amount,
        if (description != null) 'description': description,
      },
      decode: (json) => CreateOrderResult.fromJson(json as Map<String, dynamic>),
    );
  }

  Future<void> verifyPayment({
    required String razorpayOrderId,
    required String razorpayPaymentId,
    required String razorpaySignature,
  }) {
    return _api.post<void>(
      ApiConstants.paymentsVerify,
      body: {
        'razorpayOrderId': razorpayOrderId,
        'razorpayPaymentId': razorpayPaymentId,
        'razorpaySignature': razorpaySignature,
      },
      decode: (_) => null,
    );
  }

  Future<void> submitEnterpriseLead(EnterpriseLead lead) {
    return _api.post<void>(
      ApiConstants.enterpriseLeads,
      body: lead.toJson(),
      decode: (_) => null,
    );
  }
}
