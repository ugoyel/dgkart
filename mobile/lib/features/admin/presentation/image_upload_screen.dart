import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/common.dart';
import '../../../core/widgets/responsive.dart';
import '../../catalog/presentation/catalog_providers.dart';
import '../data/admin_repository.dart';

/// Multi-file image uploader. Files are matched to products by name using the
/// mapping sheet (or `SKU_n.jpg` naming) and uploaded 10 at a time.
class ImageUploadScreen extends ConsumerStatefulWidget {
  const ImageUploadScreen({super.key});

  @override
  ConsumerState<ImageUploadScreen> createState() => _ImageUploadScreenState();
}

class _ImageUploadScreenState extends ConsumerState<ImageUploadScreen> {
  final _files = <PickedFile>[];
  int _done = 0;
  bool _uploading = false;
  UploadReport? _report;

  Future<void> _pick() async {
    final res = await FilePicker.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
    );
    if (res.isEmpty) return;
    final existing = _files.map((f) => f.name).toSet();
    final added = [
      for (final f in res)
        if (!existing.contains(f.name)) await PickedFile.from(f.xFile, f.name),
    ];
    setState(() {
      _files.addAll(added);
      _report = null;
    });
  }

  Future<void> _upload() async {
    setState(() {
      _uploading = true;
      _done = 0;
    });
    try {
      final report = await ref.read(adminRepositoryProvider).uploadImages(
            _files,
            onProgress: (done, _) => setState(() => _done = done),
          );
      setState(() {
        _report = report;
        _files.clear();
      });
      ref.invalidate(adminStatsProvider);
      ref.invalidate(homeFeedProvider);
    } catch (e) {
      if (mounted) showSnack(context, e.toString());
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final totalMb = _files.fold<int>(0, (s, f) => s + f.size) / (1024 * 1024);
    return Scaffold(
      appBar: AppBar(title: const Text('Upload product images')),
      body: ContentWidth(
        maxWidth: 760,
        child: ListView(padding: const EdgeInsets.all(16), children: [
          const Text(
            'Select as many images as you like. Each file is attached to a product using your mapping sheet. '
            'Files named like SKU.jpg or SKU_2.jpg are matched automatically even without a mapping row. '
            'Uploading the same file name again replaces the old image.',
            style: TextStyle(height: 1.4),
          ),
          const SizedBox(height: 16),
          OutlinedButton.icon(
            onPressed: _uploading ? null : _pick,
            icon: const Icon(Icons.add_photo_alternate_outlined),
            label: Text(_files.isEmpty ? 'Select images' : 'Add more images'),
          ),
          if (_files.isNotEmpty) ...[
            const SizedBox(height: 12),
            Text('${_files.length} images selected • ${totalMb.toStringAsFixed(1)} MB'),
            const SizedBox(height: 8),
            if (_uploading) ...[
              LinearProgressIndicator(value: _done / _files.length, minHeight: 6, borderRadius: BorderRadius.circular(3)),
              const SizedBox(height: 6),
              Text('Uploaded $_done of ${_files.length}'),
            ],
            const SizedBox(height: 12),
            FilledButton(onPressed: _uploading ? null : _upload, child: Text('Upload ${_files.length} images')),
            const SizedBox(height: 8),
            ConstrainedBox(
              constraints: const BoxConstraints(maxHeight: 280),
              child: ListView(shrinkWrap: true, children: [
                for (final f in _files)
                  ListTile(
                    dense: true,
                    leading: const Icon(Icons.image_outlined),
                    title: Text(f.name),
                    trailing: _uploading
                        ? null
                        : IconButton(icon: const Icon(Icons.close), onPressed: () => setState(() => _files.remove(f))),
                  ),
              ]),
            ),
          ],
          if (_report != null) ...[
            const Divider(height: 32),
            Row(children: [
              const Icon(Icons.check_circle, color: DkColors.success),
              const SizedBox(width: 8),
              Text('${_report!.matched.length} images attached', style: const TextStyle(fontWeight: FontWeight.w700)),
            ]),
            if (_report!.unmatched.isNotEmpty) ...[
              const SizedBox(height: 12),
              Row(children: [
                const Icon(Icons.warning_amber, color: DkColors.deal),
                const SizedBox(width: 8),
                Text('${_report!.unmatched.length} not matched', style: const TextStyle(fontWeight: FontWeight.w700, color: DkColors.deal)),
              ]),
              for (final u in _report!.unmatched)
                ListTile(dense: true, title: Text(u.file), subtitle: Text(u.reason)),
            ],
          ],
        ]),
      ),
    );
  }
}
