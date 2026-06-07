/// A single redemption record as returned by the API. The seller-side cares
/// about: which offer / customer it's for, the QR code, status + timestamps,
/// and (after confirm) the discount applied and final amount.
class RedemptionInfo {
  RedemptionInfo({
    required this.id,
    required this.qrCode,
    required this.status,
    required this.offerId,
    required this.customerId,
    required this.branchId,
    required this.expiresAt,
    this.offerTitle,
    this.offerType,
    this.discountValue,
    this.couponCode,
    this.customerName,
    this.customerEmail,
    this.customerPhone,
    this.redeemedAt,
    this.finalAmount,
    this.discountApplied,
    this.notes,
  });

  final String id;
  final String qrCode;
  final String status; // PENDING | REDEEMED | EXPIRED | CANCELLED
  final String offerId;
  final String customerId;
  final String branchId;
  final DateTime expiresAt;
  final String? offerTitle;
  final String? offerType;
  final num? discountValue;
  final String? couponCode;
  final String? customerName;
  final String? customerEmail;
  final String? customerPhone;
  final DateTime? redeemedAt;
  final num? finalAmount;
  final num? discountApplied;
  final String? notes;

  bool get isPending => status.toUpperCase() == 'PENDING';
  bool get isRedeemed => status.toUpperCase() == 'REDEEMED';

  factory RedemptionInfo.fromJson(Map<String, dynamic> j) {
    final offer = j['offer'] as Map<String, dynamic>?;
    final customer = j['customer'] as Map<String, dynamic>?;
    return RedemptionInfo(
      id: j['id'] as String,
      qrCode: j['qrCode'] as String,
      status: j['status'] as String? ?? 'PENDING',
      offerId: j['offerId'] as String,
      customerId: j['customerId'] as String,
      branchId: j['branchId'] as String,
      expiresAt: DateTime.parse(j['expiresAt'] as String),
      offerTitle: offer?['title'] as String?,
      offerType: offer?['offerType'] as String?,
      discountValue: offer?['discountValue'] as num?,
      couponCode: offer?['couponCode'] as String?,
      customerName: customer?['fullName'] as String?,
      customerEmail: customer?['email'] as String?,
      customerPhone: customer?['phone'] as String?,
      redeemedAt: j['redeemedAt'] == null ? null : DateTime.parse(j['redeemedAt'] as String),
      finalAmount: j['finalAmount'] as num?,
      discountApplied: j['discountApplied'] as num?,
      notes: j['notes'] as String?,
    );
  }
}
