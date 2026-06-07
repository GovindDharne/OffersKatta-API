class Redemption {
  const Redemption({
    required this.id,
    required this.qrCode,
    required this.status,
    required this.expiresAt,
    required this.offerId,
    this.offerTitle,
    this.branchName,
    this.redeemedAt,
  });

  final String id;
  final String qrCode;
  final String status;
  final DateTime expiresAt;
  final String offerId;
  final String? offerTitle;
  final String? branchName;
  final DateTime? redeemedAt;

  bool get isPending => status == 'PENDING';
  bool get isRedeemed => status == 'REDEEMED';
}

class IssuedRedemption {
  const IssuedRedemption({required this.redemption, required this.qrDataUrl});
  final Redemption redemption;
  final String qrDataUrl;
}
