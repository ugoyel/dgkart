import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'auth_controller.dart';

/// Returns true when signed in; otherwise opens login and returns false.
bool requireLogin(BuildContext context, WidgetRef ref) {
  if (ref.read(currentUserProvider) != null) return true;
  final here = GoRouterState.of(context).uri.toString();
  context.push('/login?from=${Uri.encodeComponent(here)}');
  return false;
}
