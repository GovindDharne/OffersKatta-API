enum UserRole {
  superAdmin,
  sellerOwner,
  businessManager,
  staff,
  customer;

  static UserRole fromString(String value) {
    switch (value) {
      case 'SUPER_ADMIN': return UserRole.superAdmin;
      case 'SELLER_OWNER': return UserRole.sellerOwner;
      case 'BUSINESS_MANAGER': return UserRole.businessManager;
      case 'STAFF': return UserRole.staff;
      case 'CUSTOMER':
      default: return UserRole.customer;
    }
  }

  String get apiName {
    switch (this) {
      case UserRole.superAdmin: return 'SUPER_ADMIN';
      case UserRole.sellerOwner: return 'SELLER_OWNER';
      case UserRole.businessManager: return 'BUSINESS_MANAGER';
      case UserRole.staff: return 'STAFF';
      case UserRole.customer: return 'CUSTOMER';
    }
  }
}

class AuthUser {
  const AuthUser({
    required this.id,
    required this.role,
    this.email,
    this.fullName,
    this.phone,
    this.avatarUrl,
  });

  final String id;
  final UserRole role;
  final String? email;
  final String? fullName;
  final String? phone;
  final String? avatarUrl;

  String get displayName => fullName ?? email ?? phone ?? 'OffersKatta user';
}
