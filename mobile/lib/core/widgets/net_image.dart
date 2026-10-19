import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

class NetImage extends StatelessWidget {
  const NetImage(this.url, {super.key, this.fit = BoxFit.cover, this.radius = 8, this.cacheWidth = 600});
  /// A network URL, or `asset:<path>` for a picture bundled with the app.
  final String? url;
  static const _assetScheme = 'asset:';
  final BoxFit fit;
  final double radius;

  /// Decode width for thumbnails (saves memory in long lists). Null = full resolution.
  /// Ignored on web, where the browser decodes images and resized decodes can render black.
  final int? cacheWidth;

  @override
  Widget build(BuildContext context) {
    final placeholder = Container(
      color: DkColors.surface,
      alignment: Alignment.center,
      child: const Icon(Icons.image_outlined, color: DkColors.divider, size: 32),
    );
    return ClipRRect(
      borderRadius: BorderRadius.circular(radius),
      child: switch (url) {
        null => placeholder,
        final u when u.startsWith(_assetScheme) =>
          Image.asset(u.substring(_assetScheme.length), fit: fit, errorBuilder: (_, _, _) => placeholder),
        final u => CachedNetworkImage(
            imageUrl: u,
            fit: fit,
            fadeInDuration: const Duration(milliseconds: 150),
            placeholder: (_, _) => placeholder,
            errorWidget: (_, _, _) => placeholder,
            memCacheWidth: kIsWeb ? null : cacheWidth,
          ),
      },
    );
  }
}
