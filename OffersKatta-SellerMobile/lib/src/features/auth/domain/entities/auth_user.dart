/// Backend role names — keep in sync with API's UserRole enum.
class SellerRoles {
  SellerRoles._();
  static const sellerOwner    = 'SELLER_OWNER';
  static const businessManager = 'BUSINESS_MANAGER';
  static const staff          = 'STAFF';
  static const superAdmin     = 'SUPER_ADMIN';

  /// Roles allowed to use the seller mobile app.
  /// Customers go to the consumer app; this app would be unusable for them.
  static const Set<String> allowed = {
    sellerOwner, businessManager, staff, superAdmin,
  };
}

class AuthUser {
  AuthUser({
    required this.id,
    required this.email,
    required this.role,
    this.fullName,
    this.phone,
  });
  final String id;
  final String email;
  final String role;
  final String? fullName;
  final String? phone;

  bool get isAllowedForSeller => SellerRoles.allowed.contains(role);
  String get initial =>
      ((fullName?.isNotEmpty ?? false) ? fullName! : email).substring(0, 1).toUpperCase();
}
