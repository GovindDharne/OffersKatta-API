import '../datasources/subscription_remote_datasource.dart';
import '../models/subscription_models.dart';

class SubscriptionRepository {
  SubscriptionRepository(this._remote);
  final SubscriptionRemoteDataSource _remote;

  Future<List<Plan>> plans() => _remote.getPlans();
  Future<PaymentsConfig> paymentsConfig() => _remote.getPaymentsConfig();
  Future<SubscriptionInfo?> forBrand(String brandId) => _remote.getForBrand(brandId);
  Future<List<PaymentRecord>> paymentsForBrand(String brandId) =>
      _remote.paymentsForBrand(brandId);

  Future<ChangePlanResult> changePlan({
    required String brandId,
    required PlanName plan,
    required BillingInterval billingInterval,
  }) =>
      _remote.changePlan(brandId: brandId, plan: plan, billingInterval: billingInterval);

  Future<CreateOrderResult> createOrder({
    required String brandId,
    required num amount,
    String? description,
  }) =>
      _remote.createOrder(brandId: brandId, amount: amount, description: description);

  Future<void> verifyPayment({
    required String razorpayOrderId,
    required String razorpayPaymentId,
    required String razorpaySignature,
  }) =>
      _remote.verifyPayment(
        razorpayOrderId: razorpayOrderId,
        razorpayPaymentId: razorpayPaymentId,
        razorpaySignature: razorpaySignature,
      );

  Future<void> submitEnterpriseLead(EnterpriseLead lead) =>
      _remote.submitEnterpriseLead(lead);
}
