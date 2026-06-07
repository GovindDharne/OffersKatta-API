/// Plan tiers — mirrors the backend's SubscriptionPlan enum.
enum PlanName { free, premium, featured, enterprise }

PlanName planNameFromString(String s) {
  switch (s.toUpperCase()) {
    case 'FREE':
      return PlanName.free;
    case 'PREMIUM':
      return PlanName.premium;
    case 'FEATURED':
      return PlanName.featured;
    case 'ENTERPRISE':
      return PlanName.enterprise;
    default:
      throw ArgumentError('Unknown plan name: $s');
  }
}

String planNameToApi(PlanName p) {
  switch (p) {
    case PlanName.free:
      return 'FREE';
    case PlanName.premium:
      return 'PREMIUM';
    case PlanName.featured:
      return 'FEATURED';
    case PlanName.enterprise:
      return 'ENTERPRISE';
  }
}

String planNameLabel(PlanName p) {
  switch (p) {
    case PlanName.free:
      return 'Free';
    case PlanName.premium:
      return 'Premium';
    case PlanName.featured:
      return 'Featured';
    case PlanName.enterprise:
      return 'Enterprise';
  }
}

enum BillingInterval { monthly, yearly }

String billingIntervalToApi(BillingInterval b) =>
    b == BillingInterval.monthly ? 'MONTHLY' : 'YEARLY';

BillingInterval billingIntervalFromString(String s) =>
    s.toUpperCase() == 'YEARLY' ? BillingInterval.yearly : BillingInterval.monthly;

class Plan {
  Plan({
    required this.plan,
    required this.monthly,
    required this.yearly,
    required this.currency,
    required this.contactSales,
  });

  final PlanName plan;
  final num? monthly;
  final num? yearly;
  final String currency;
  final bool contactSales;

  factory Plan.fromJson(Map<String, dynamic> j) => Plan(
        plan: planNameFromString(j['plan'] as String),
        monthly: j['monthly'] as num?,
        yearly: j['yearly'] as num?,
        currency: (j['currency'] as String?) ?? 'INR',
        contactSales: (j['contactSales'] as bool?) ?? false,
      );
}

class SubscriptionInfo {
  SubscriptionInfo({
    required this.id,
    required this.plan,
    required this.status,
    required this.startDate,
    required this.endDate,
    required this.amount,
    required this.currency,
    required this.billingInterval,
  });

  final String id;
  final PlanName plan;
  final String status;
  final DateTime startDate;
  final DateTime? endDate;
  final num amount;
  final String currency;
  final BillingInterval billingInterval;

  bool get isActiveAndUnexpired =>
      status.toUpperCase() == 'ACTIVE' &&
      endDate != null &&
      endDate!.isAfter(DateTime.now());

  factory SubscriptionInfo.fromJson(Map<String, dynamic> j) => SubscriptionInfo(
        id: j['id'] as String,
        plan: planNameFromString(j['plan'] as String),
        status: j['status'] as String,
        startDate: DateTime.parse(j['startDate'] as String),
        endDate: j['endDate'] == null ? null : DateTime.parse(j['endDate'] as String),
        amount: (j['amount'] as num?) ?? 0,
        currency: (j['currency'] as String?) ?? 'INR',
        billingInterval: billingIntervalFromString((j['billingInterval'] as String?) ?? 'MONTHLY'),
      );
}

class ChangePlanResult {
  ChangePlanResult({required this.subscription, required this.amount});

  final SubscriptionInfo subscription;
  final num amount;

  factory ChangePlanResult.fromJson(Map<String, dynamic> j) => ChangePlanResult(
        subscription: SubscriptionInfo.fromJson(j['subscription'] as Map<String, dynamic>),
        amount: (j['amount'] as num?) ?? 0,
      );
}

class PaymentRecord {
  PaymentRecord({
    required this.id,
    required this.amount,
    required this.currency,
    required this.status,
    required this.description,
    required this.createdAt,
    required this.paidAt,
  });

  final String id;
  final num amount;
  final String currency;
  final String status;
  final String? description;
  final DateTime createdAt;
  final DateTime? paidAt;

  factory PaymentRecord.fromJson(Map<String, dynamic> j) => PaymentRecord(
        id: j['id'] as String,
        amount: (j['amount'] as num?) ?? 0,
        currency: (j['currency'] as String?) ?? 'INR',
        status: (j['status'] as String?) ?? 'PENDING',
        description: j['description'] as String?,
        createdAt: DateTime.parse(j['createdAt'] as String),
        paidAt: j['paidAt'] == null ? null : DateTime.parse(j['paidAt'] as String),
      );
}

class PaymentsConfig {
  PaymentsConfig({required this.enabled, required this.keyId});
  final bool enabled;
  final String? keyId;

  factory PaymentsConfig.fromJson(Map<String, dynamic> j) => PaymentsConfig(
        enabled: (j['enabled'] as bool?) ?? false,
        keyId: j['keyId'] as String?,
      );
}

class RazorpayOrder {
  RazorpayOrder({required this.id, required this.amount, required this.currency});
  final String id;
  final num amount;
  final String currency;

  factory RazorpayOrder.fromJson(Map<String, dynamic> j) => RazorpayOrder(
        id: j['id'] as String,
        amount: (j['amount'] as num?) ?? 0,
        currency: (j['currency'] as String?) ?? 'INR',
      );
}

class CreateOrderResult {
  CreateOrderResult({required this.order});
  final RazorpayOrder order;

  factory CreateOrderResult.fromJson(Map<String, dynamic> j) =>
      CreateOrderResult(order: RazorpayOrder.fromJson(j['order'] as Map<String, dynamic>));
}

class EnterpriseLead {
  EnterpriseLead({
    required this.companyName,
    required this.contactName,
    required this.email,
    this.phone,
    this.estimatedBranches,
    this.message,
    this.brandId,
  });

  final String companyName;
  final String contactName;
  final String email;
  final String? phone;
  final int? estimatedBranches;
  final String? message;
  final String? brandId;

  Map<String, dynamic> toJson() => {
        'companyName': companyName,
        'contactName': contactName,
        'email': email,
        if (phone != null && phone!.isNotEmpty) 'phone': phone,
        if (estimatedBranches != null) 'estimatedBranches': estimatedBranches,
        if (message != null && message!.isNotEmpty) 'message': message,
        if (brandId != null && brandId!.isNotEmpty) 'brandId': brandId,
      };
}
