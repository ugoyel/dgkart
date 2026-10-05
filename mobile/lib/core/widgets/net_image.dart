import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

class NetImage extends StatelessWidget {
  const NetImage(this.url, {super.key, this.fit = BoxFit.cover, this.radius = 8, this.cacheWidth = 600});
  final String? url;
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
      child: url == null
          ? placeholder
          : CachedNetworkImage(
              imageUrl: url!,
              fit: fit,
              fadeInDuration: const Duration(milliseconds: 150),
              placeholder: (_, _) => placeholder,
              errorWidget: (_, _, _) => placeholder,
              memCacheWidth: kIsWeb ? null : cacheWidth,
            ),
    );
  }
}
