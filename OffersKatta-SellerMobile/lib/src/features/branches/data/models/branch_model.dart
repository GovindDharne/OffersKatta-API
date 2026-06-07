import '../../domain/entities/branch.dart';

class BranchModel {
  BranchModel({
    required this.id,
    required this.brandId,
    required this.name,
    required this.addressLine1,
    required this.city,
    required this.state,
    required this.country,
    required this.postalCode,
    required this.latitude,
    required this.longitude,
    required this.status,
    this.addressLine2,
    this.phone,
    this.email,
    this.brandName,
    this.mallName,
    this.shopNumber,
  });

  factory BranchModel.fromJson(Map<String, dynamic> j) {
    final brand = j['brand'];
    final mall = j['mall'];
    return BranchModel(
      id: j['id'] as String,
      brandId: j['brandId'] as String,
      name: j['name'] as String,
      addressLine1: j['addressLine1'] as String,
      addressLine2: j['addressLine2'] as String?,
      city: j['city'] as String,
      state: j['state'] as String,
      country: j['country'] as String,
      postalCode: j['postalCode'] as String,
      latitude: (j['latitude'] as num).toDouble(),
      longitude: (j['longitude'] as num).toDouble(),
      phone: j['phone'] as String?,
      email: j['email'] as String?,
      status: j['status'] as String? ?? 'ACTIVE',
      brandName: brand is Map<String, dynamic> ? brand['name'] as String? : null,
      mallName: mall is Map<String, dynamic> ? mall['name'] as String? : null,
      shopNumber: j['shopNumber'] as String?,
    );
  }

  final String id;
  final String brandId;
  final String name;
  final String addressLine1;
  final String? addressLine2;
  final String city;
  final String state;
  final String country;
  final String postalCode;
  final double latitude;
  final double longitude;
  final String? phone;
  final String? email;
  final String status;
  final String? brandName;
  final String? mallName;
  final String? shopNumber;

  BusinessBranch toEntity() => BusinessBranch(
        id: id,
        brandId: brandId,
        name: name,
        addressLine1: addressLine1,
        addressLine2: addressLine2,
        city: city,
        state: state,
        country: country,
        postalCode: postalCode,
        latitude: latitude,
        longitude: longitude,
        phone: phone,
        email: email,
        status: status,
        brandName: brandName,
        mallName: mallName,
        shopNumber: shopNumber,
      );
}
