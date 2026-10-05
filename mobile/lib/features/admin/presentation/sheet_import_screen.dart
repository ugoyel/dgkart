import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/common.dart';
import '../../../core/widgets/responsive.dart';
import '../../catalog/presentation/catalog_providers.dart';
import '../data/admin_repository.dart';
import 'job_progress.dart';

enum SheetKind { products, mapping }

/// Upload the products sheet or the image mapping sheet and watch it import.
class SheetImportScreen extends ConsumerStatefulWidget {
  const SheetImportScreen({super.key, required this.kind});
  final SheetKind kind;

  @override
  ConsumerState<SheetImportScreen> createState() => _SheetImportScreenState();
}

class _SheetImportScreenState extends ConsumerState<SheetImportScreen> {
  PickedFile? _file;
  double? _uploadProgress;
  ImportJob? _job;

  bool get _isProducts => widget.kind == SheetKind.products;

  Future<void> _pick() async {
    final f = await FilePicker.pickFile(type: FileType.custom, allowedExtensions: ['xlsx', 'csv']);
    if (f == null) return;
    final picked = await PickedFile.from(f.xFile, f.name);
    setState(() {
      _file = picked;
      _job = null;
    });
  }

  Future<void> _upload() async {
    setState(() => _uploadProgress = 0);
    try {
      final job = await ref.read(adminRepositoryProvider).uploadSheet(
            _isProducts ? 'products' : 'mapping',
            _file!,
            onProgress: (p) => setState(() => _uploadProgress = p),
          );
      setState(() => _job = job);
    } catch (e) {
      if (mounted) showSnack(context, e.toString());
    } finally {
      if (mounted) setState(() => _uploadProgress = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final columns = _isProducts
        ? const [
            ('sku', 'Required. Your unique product code, e.g. DK-TSHIRT-001'),
            ('title', 'Required. Product name'),
            ('price', 'Required. Selling price in ₹'),
            ('mrp', 'Optional. Original price (shows "% off")'),
            ('stock', 'Optional. Quantity available'),
            ('brand, category', 'Optional. New categories are created automatically'),
            ('condition', 'New / Open box / Refurbished / Used'),
            ('free_shipping', 'yes / no (default yes)'),
            ('description', 'Optional'),
            ('specs', 'Optional. "Colour=Red; Size=M"'),
            ('images', 'Optional. Image URLs, or image file names you will upload'),
          ]
        : const [
            ('image_file_name', 'Required. Exact file name, e.g. shoe-red-1.jpg'),
            ('sku', 'Required. SKU from your products sheet'),
            ('position', 'Optional. 0 = main image, 1, 2, … for the rest'),
          ];
    return Scaffold(
      appBar: AppBar(title: Text(_isProducts ? 'Import products' : 'Import image mapping')),
      body: ContentWidth(
        maxWidth: 760,
        child: ListView(padding: const EdgeInsets.all(16), children: [
          Text(
            _isProducts
                ? 'Upload an Excel (.xlsx) or CSV file with one product per row. Large files are processed in batches in the background, so you can import tens of thousands of products.'
                : 'Upload a sheet that maps each image file name to a product SKU. Then go to "Upload product images" and select the image files.',
            style: const TextStyle(height: 1.4),
          ),
          const SizedBox(height: 16),
          Container(
            decoration: BoxDecoration(border: Border.all(color: DkColors.divider), borderRadius: BorderRadius.circular(12)),
            child: Column(children: [
              for (final (col, desc) in columns)
                ListTile(
                  dense: true,
                  title: Text(col, style: const TextStyle(fontFamily: 'monospace', fontWeight: FontWeight.w600)),
                  subtitle: Text(desc),
                ),
            ]),
          ),
          const SizedBox(height: 20),
          OutlinedButton.icon(
            onPressed: _uploadProgress != null ? null : _pick,
            icon: const Icon(Icons.attach_file),
            label: Text(_file == null ? 'Choose .xlsx or .csv file' : _file!.name),
          ),
          const SizedBox(height: 12),
          FilledButton(
            onPressed: _file == null || _uploadProgress != null ? null : _upload,
            child: Text(_uploadProgress != null ? 'Uploading ${(_uploadProgress! * 100).round()}%' : 'Upload and import'),
          ),
          if (_job != null) ...[
            const SizedBox(height: 24),
            JobProgressView(
              key: ValueKey(_job!.id),
              initial: _job!,
              onFinished: (_) {
                ref.invalidate(adminStatsProvider);
                ref.invalidate(homeFeedProvider);
                ref.invalidate(categoriesProvider);
              },
            ),
          ],
        ]),
      ),
    );
  }
}
