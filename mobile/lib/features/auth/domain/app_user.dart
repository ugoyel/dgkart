import '../../account/domain/address.dart';

enum UserRole { user, admin }

class AppUser {
  const AppUser({required this.id, required this.phone, this.name, this.email, required this.role, this.addresses = const []});

  final String id;
  final String phone;
  final String? name;
  final String? email;
  final UserRole role;
  final List<Address> addresses;

  bool get isAdmin => role == UserRole.admin;
  String get displayName => (name?.isNotEmpty ?? false) ? name! : phone;

  Address? get defaultAddress =>
      addresses.isEmpty ? null : addresses.firstWhere((a) => a.isDefault, orElse: () => addresses.first);

  factory AppUser.fromJson(Map<String, dynamic> j) => AppUser(
        id: j['id'] as String,
        phone: j['phone'] as String,
        name: j['name'] as String?,
        email: j['email'] as String?,
        role: j['role'] == 'ADMIN' ? UserRole.admin : UserRole.user,
        addresses: ((j['addresses'] as List?) ?? []).map((e) => Address.fromJson(e as Map<String, dynamic>)).toList(),
      );
}
