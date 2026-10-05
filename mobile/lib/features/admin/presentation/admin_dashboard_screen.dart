import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/config/app_config.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/common.dart';
import '../../../core/widgets/responsive.dart';
import '../../catalog/presentation/catalog_providers.dart';
import '../data/admin_repository.dart';
import 'job_progress.dart';

/// Admin home (only reachable by the admin mobile number).
class AdminDashboardScreen extends ConsumerWidget {
  const AdminDashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final stats = ref.watch(adminStatsProvider);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Admin'),
        actions: [IconButton(icon: const Icon(Icons.refresh), onPressed: () => ref.invalidate(adminStatsProvider))],
      ),
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(adminStatsProvider.future),
        child: ContentWidth(
          maxWidth: 1000,
          child: ListView(padding: const EdgeInsets.all(16), children: [
            AsyncView(
              value: stats,
              onRetry: () => ref.invalidate(adminStatsProvider),
              data: (s) => LayoutBuilder(
                builder: (_, c) => GridView.count(
                  crossAxisCount: c.maxWidth > 700 ? 4 : 2,
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  mainAxisSpacing: 12,
                  crossAxisSpacing: 12,
                  childAspectRatio: 1.9,
                  children: [
                    _Stat('Products', formatCompact(s.products), Icons.inventory_2_outlined),
                    _Stat('Demo products', formatCompact(s.dummyProducts), Icons.science_outlined),
                    _Stat('Without images', formatCompact(s.withoutImages), Icons.hide_image_outlined),
                    _Stat('Image mappings', formatCompact(s.imageMappings), Icons.link),
                    _Stat('Users', formatCompact(s.users), Icons.people_outline),
                    _Stat('Orders', formatCompact(s.orders), Icons.receipt_long_outlined),
                    _Stat('Revenue', formatPrice(s.revenue), Icons.currency_rupee),
                  ],
                ),
              ),
            ),
            const SectionHeader('Catalogue upload'),
            _Action(
              icon: Icons.table_view_outlined,
              title: '1. Import products from Excel',
              subtitle: 'Upload .xlsx or .csv. Existing SKUs are updated, new ones added.',
              onTap: () => context.push('/admin/import/products'),
            ),
            _Action(
              icon: Icons.link,
              title: '2. Import image mapping sheet',
              subtitle: 'Tells which image file name belongs to which SKU.',
              onTap: () => context.push('/admin/import/mapping'),
            ),
            _Action(
              icon: Icons.photo_library_outlined,
              title: '3. Upload product images',
              subtitle: 'Select many images at once; each is matched by its file name.',
              onTap: () => context.push('/admin/images'),
            ),
            _Action(
              icon: Icons.download_outlined,
              title: 'Download Excel templates',
              subtitle: 'Products template and image mapping template',
              onTap: () => _templates(context),
            ),
            const SectionHeader('Orders'),
            _Action(icon: Icons.local_shipping_outlined, title: 'Manage orders', subtitle: 'Update status: shipped, delivered, cancelled', onTap: () => context.push('/admin/orders')),
            _Action(icon: Icons.history, title: 'Recent import jobs', subtitle: 'Progress and row errors', onTap: () => context.push('/admin/jobs')),
            const SectionHeader('Demo data'),
            _Action(icon: Icons.auto_awesome_outlined, title: 'Add demo products', subtitle: 'Fill the store with sample items and images', onTap: () => _seed(context, ref)),
            _Action(
              icon: Icons.cleaning_services_outlined,
              title: 'Remove all demo products',
              subtitle: 'Deletes only sample items. Your imported products stay.',
              color: DkColors.accent,
              onTap: () => _wipeDummy(context, ref),
            ),
            _Action(
              icon: Icons.delete_forever_outlined,
              title: 'Delete entire catalogue',
              subtitle: 'Blank out every product. Orders are kept.',
              color: DkColors.deal,
              onTap: () => _wipeAll(context, ref),
            ),
            const SizedBox(height: 40),
          ]),
        ),
      ),
    );
  }

  void _refreshCatalog(WidgetRef ref) {
    ref.invalidate(adminStatsProvider);
    ref.invalidate(homeFeedProvider);
    ref.invalidate(categoriesProvider);
  }

  Future<void> _templates(BuildContext context) async {
    if (AppConfig.demoMode) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Templates download from the DKKart server, which this offline demo does not use.')));
      return;
    }
    final base = '${AppConfig.apiRoot}/admin/templates';
    await showModalBottomSheet<void>(
      context: context,
      builder: (_) => SafeArea(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          ListTile(
            leading: const Icon(Icons.table_view_outlined),
            title: const Text('Products template (.xlsx)'),
            onTap: () => launchUrl(Uri.parse('$base/products.xlsx'), mode: LaunchMode.externalApplication),
          ),
          ListTile(
            leading: const Icon(Icons.link),
            title: const Text('Image mapping template (.xlsx)'),
            onTap: () => launchUrl(Uri.parse('$base/image-mapping.xlsx'), mode: LaunchMode.externalApplication),
          ),
        ]),
      ),
    );
  }

  Future<void> _seed(BuildContext context, WidgetRef ref) async {
    final count = await showDialog<int>(
      context: context,
      builder: (_) => SimpleDialog(
        title: const Text('How many demo products?'),
        children: [
          for (final n in [500, 1000, 5000, 10000])
            SimpleDialogOption(onPressed: () => Navigator.pop(context, n), child: Text('${formatCompact(n)} products')),
        ],
      ),
    );
    if (count == null || !context.mounted) return;
    try {
      final job = await ref.read(adminRepositoryProvider).seed(count);
      if (!context.mounted) return;
      await showJobDialog(context, ref, job, title: 'Adding demo products');
      _refreshCatalog(ref);
    } catch (e) {
      if (context.mounted) showSnack(context, e.toString());
    }
  }

  Future<void> _wipeDummy(BuildContext context, WidgetRef ref) async {
    final ok = await _confirm(context, 'Remove all demo products?', 'Imported products are not affected.');
    if (ok != true) return;
    try {
      final n = await ref.read(adminRepositoryProvider).wipeDummy();
      _refreshCatalog(ref);
      if (context.mounted) showSnack(context, 'Removed $n demo products');
    } catch (e) {
      if (context.mounted) showSnack(context, e.toString());
    }
  }

  Future<void> _wipeAll(BuildContext context, WidgetRef ref) async {
    final text = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Delete every product?'),
        content: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('This cannot be undone. Type DELETE to confirm.'),
          const SizedBox(height: 12),
          TextField(controller: text, autofocus: true),
        ]),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          TextButton(
            onPressed: () => Navigator.pop(context, text.text.trim() == 'DELETE'),
            child: const Text('Delete', style: TextStyle(color: DkColors.deal)),
          ),
        ],
      ),
    );
    if (ok != true) return;
    try {
      final n = await ref.read(adminRepositoryProvider).wipeAll();
      _refreshCatalog(ref);
      if (context.mounted) showSnack(context, 'Deleted $n products');
    } catch (e) {
      if (context.mounted) showSnack(context, e.toString());
    }
  }

  Future<bool?> _confirm(BuildContext context, String title, String body) => showDialog<bool>(
        context: context,
        builder: (_) => AlertDialog(
          title: Text(title),
          content: Text(body),
          actions: [
            TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
            TextButton(onPressed: () => Navigator.pop(context, true), child: const Text('Remove')),
          ],
        ),
      );
}

class _Stat extends StatelessWidget {
  const _Stat(this.label, this.value, this.icon);
  final String label;
  final String value;
  final IconData icon;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(color: DkColors.surface, borderRadius: BorderRadius.circular(12)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.center, children: [
          Row(children: [
            Icon(icon, size: 16, color: DkColors.textMuted),
            const SizedBox(width: 6),
            Expanded(child: Text(label, overflow: TextOverflow.ellipsis, style: const TextStyle(color: DkColors.textMuted, fontSize: 12))),
          ]),
          const SizedBox(height: 6),
          FittedBox(child: Text(value, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800))),
        ]),
      );
}

class _Action extends StatelessWidget {
  const _Action({required this.icon, required this.title, required this.subtitle, required this.onTap, this.color});
  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;
  final Color? color;

  @override
  Widget build(BuildContext context) => Card(
        elevation: 0,
        margin: const EdgeInsets.only(bottom: 10),
        shape: RoundedRectangleBorder(side: const BorderSide(color: DkColors.divider), borderRadius: BorderRadius.circular(12)),
        child: ListTile(
          leading: Icon(icon, color: color ?? DkColors.primary),
          title: Text(title, style: TextStyle(fontWeight: FontWeight.w600, color: color)),
          subtitle: Text(subtitle),
          trailing: const Icon(Icons.chevron_right),
          onTap: onTap,
        ),
      );
}
