import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/theme/app_theme.dart';
import '../router/app_router.dart';

class OffersKattaApp extends ConsumerWidget {
  const OffersKattaApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(appRouterProvider);
    return MaterialApp.router(
      title: 'OffersKatta',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light,
      darkTheme: AppTheme.dark,
      themeMode: ThemeMode.system,
      scrollBehavior: const _NoStretchScrollBehavior(),
      routerConfig: router,
    );
  }
}

/// Disables Android 12+ stretch overscroll indicator. The stretch effect is a
/// RenderTransform wrapping the scrollable's content; on some Android builds
/// it tries to paint before its child finishes its first layout pass, which
/// trips a "RenderBox was not laid out" assertion. Returning the child
/// unchanged means scrollables simply don't get a stretch overlay (taps and
/// scrolling still work normally).
class _NoStretchScrollBehavior extends MaterialScrollBehavior {
  const _NoStretchScrollBehavior();

  @override
  Widget buildOverscrollIndicator(BuildContext context, Widget child, ScrollableDetails details) {
    return child;
  }
}
