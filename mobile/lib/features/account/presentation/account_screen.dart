import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/config/app_config.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/common.dart';
import '../../../core/widgets/dk_logo.dart';
import '../../../core/widgets/responsive.dart';
import '../../auth/presentation/auth_controller.dart';

/// "My DGkart" hub: purchases, watchlist, addresses, profile, admin (for the admin number).
class AccountScreen extends ConsumerWidget {
  const AccountScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(currentUserProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('My DGkart')),
      body: ContentWidth(
        maxWidth: 760,
        child: ListView(children: [
          if (user == null)
            Padding(
              padding: const EdgeInsets.all(24),
              child: Column(children: [
                const DkLogo(size: 32),
                const SizedBox(height: 16),
                const Text('Sign in to see your purchases, watchlist and more.', textAlign: TextAlign.center),
                const SizedBox(height: 16),
                FilledButton(onPressed: () => context.push('/login?from=/account'), child: const Text('Sign in')),
              ]),
            )
          else ...[
            ListTile(
              contentPadding: const EdgeInsets.all(16),
              leading: CircleAvatar(
                radius: 28,
                backgroundColor: DkColors.navy,
                child: Text(user.displayName.characters.first.toUpperCase(),
                    style: const TextStyle(color: Colors.white, fontSize: 22)),
              ),
              title: Text(user.displayName, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
              subtitle: Text(user.isAdmin ? '${user.phone} • Admin' : user.phone),
              trailing: TextButton(onPressed: () => _editProfile(context, ref), child: const Text('Edit')),
            ),
            if (user.isAdmin)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: FilledButton.icon(
                  style: FilledButton.styleFrom(backgroundColor: DkColors.navy),
                  onPressed: () => context.go('/admin'),
                  icon: const Icon(Icons.admin_panel_settings_outlined),
                  label: const Text('Open admin panel'),
                ),
              ),
            const SizedBox(height: 8),
            _tile(Icons.receipt_long_outlined, 'Purchases', () => context.push('/account/orders')),
            _tile(Icons.favorite_border, 'Watchlist', () => context.push('/account/watchlist')),
            _tile(Icons.location_on_outlined, 'Addresses', () => context.push('/account/addresses')),
          ],
          const Divider(),
          _tile(Icons.privacy_tip_outlined, 'Privacy policy', () => launchUrl(Uri.parse(AppConfig.privacyPolicyUrl))),
          _tile(Icons.help_outline, 'Help & contact', () => launchUrl(Uri.parse('mailto:${AppConfig.supportEmail}'))),
          if (user != null)
            _tile(Icons.logout, 'Sign out', () async {
              await ref.read(authControllerProvider.notifier).logout();
              if (context.mounted) context.go('/');
            }),
          if (user != null)
            ListTile(
              leading: const Icon(Icons.person_remove_outlined, color: DkColors.deal),
              title: const Text('Delete account', style: TextStyle(color: DkColors.deal)),
              onTap: () => _deleteAccount(context, ref),
            ),
          const Padding(
            padding: EdgeInsets.all(24),
            child: Text('DGkart.com • v1.0.0', textAlign: TextAlign.center, style: TextStyle(color: DkColors.textMuted)),
          ),
        ]),
      ),
    );
  }

  Widget _tile(IconData icon, String title, VoidCallback onTap) =>
      ListTile(leading: Icon(icon), title: Text(title), trailing: const Icon(Icons.chevron_right), onTap: onTap);

  Future<void> _deleteAccount(BuildContext context, WidgetRef ref) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Delete your account?'),
        content: const Text(
            'Your profile, addresses, cart and watchlist will be permanently deleted. Order records are kept as required by law.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Delete', style: TextStyle(color: DkColors.deal)),
          ),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await ref.read(authControllerProvider.notifier).deleteAccount();
      if (context.mounted) {
        showSnack(context, 'Your account has been deleted');
        context.go('/');
      }
    } catch (e) {
      if (context.mounted) showSnack(context, e.toString());
    }
  }

  Future<void> _editProfile(BuildContext context, WidgetRef ref) async {
    final user = ref.read(currentUserProvider)!;
    final name = TextEditingController(text: user.name);
    final email = TextEditingController(text: user.email);
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Edit profile'),
        content: Column(mainAxisSize: MainAxisSize.min, children: [
          TextField(controller: name, decoration: const InputDecoration(labelText: 'Name')),
          const SizedBox(height: 12),
          TextField(controller: email, keyboardType: TextInputType.emailAddress, decoration: const InputDecoration(labelText: 'Email (optional)')),
        ]),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          TextButton(onPressed: () => Navigator.pop(context, true), child: const Text('Save')),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await ref.read(authControllerProvider.notifier).updateProfile(name: name.text.trim(), email: email.text.trim());
    } catch (e) {
      if (context.mounted) showSnack(context, e.toString());
    }
  }
}

class AddressesScreen extends ConsumerWidget {
  const AddressesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(currentUserProvider);
    final list = user?.addresses ?? const [];
    return Scaffold(
      appBar: AppBar(title: const Text('Addresses')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.push('/account/address'),
        icon: const Icon(Icons.add),
        label: const Text('Add address'),
      ),
      body: list.isEmpty
          ? const EmptyState(icon: Icons.location_off_outlined, title: 'No saved addresses')
          : ContentWidth(
              maxWidth: 760,
              child: ListView(children: [
                for (final a in list)
                  ListTile(
                    title: Text(a.isDefault ? '${a.name}  (Default)' : a.name),
                    subtitle: Text('${a.singleLine}\n+91 ${a.phone}'),
                    isThreeLine: true,
                    onTap: () => context.push('/account/address', extra: a),
                    trailing: IconButton(
                      icon: const Icon(Icons.delete_outline),
                      onPressed: () => ref
                          .read(authControllerProvider.notifier)
                          .saveAddresses(list.where((e) => e.id != a.id).toList()),
                    ),
                  ),
              ]),
            ),
    );
  }
}
