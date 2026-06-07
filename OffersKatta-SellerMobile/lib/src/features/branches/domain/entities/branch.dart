class BusinessBranch {
  BusinessBranch({
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
}
