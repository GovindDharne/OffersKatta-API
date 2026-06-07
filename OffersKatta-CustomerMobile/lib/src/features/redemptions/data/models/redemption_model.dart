import '../../domain/entities/redemption.dart';

class RedemptionModel {
  RedemptionModel({
    required this.id,
    required this.qrCode,
    required this.status,
    required this.expiresAt,
    required this.offerId,
    this.offerTitle,
    this.branchName,
    this.redeemedAt,
  });

  factory RedemptionModel.fromJson(Map<String, dynamic> json) {
    final offer = json['offer'] as Map<String, dynamic>?;
    final branch = offer?['branch'] as Map<String, dynamic>?;
    return RedemptionModel(
      id: json['id'] as String,
      qrCode: json['qrCode'] as String,
      status: json['status'] as String? ?? 'PENDING',
      expiresAt: DateTime.parse(json['expiresAt'] as String),
      offerId: (json['offerId'] as String?) ?? (offer?['id'] as String? ?? ''),
      offerTitle: offer?['title'] as String?,
      branchName: branch?['name'] as String?,
      redeemedAt: json['redeemedAt'] != null ? DateTime.tryParse(json['redeemedAt'] as String) : null,
    );
  }

  final String id;
  final String qrCode;
  final String status;
  final DateTime expiresAt;
  final String offerId;
  final String? offerTitle;
  final String? branchName;
  final DateTime? redeemedAt;

  Redemption toEntity() => Redemption(
        id: id,
        qrCode: qrCode,
        status: status,
        expiresAt: expiresAt,
        offerId: offerId,
        offerTitle: offerTitle,
        branchName: branchName,
        redeemedAt: redeemedAt,
      );
}

class IssuedRedemptionModel {
  IssuedRedemptionModel({required this.redemption, required this.qrDataUrl});

  factory IssuedRedemptionModel.fromJson(Map<String, dynamic> json) => IssuedRedemptionModel(
        redemption: RedemptionModel.fromJson(json['redemption'] as Map<String, dynamic>),
        qrDataUrl: json['qrDataUrl'] as String,
      );

  final RedemptionModel redemption;
  final String qrDataUrl;

  IssuedRedemption toEntity() =>
      IssuedRedemption(redemption: redemption.toEntity(), qrDataUrl: qrDataUrl);
}
