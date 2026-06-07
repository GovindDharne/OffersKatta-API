import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../features/auth/presentation/providers/auth_providers.dart';
import '../features/auth/presentation/screens/login_screen.dart';
import '../features/auth/presentation/screens/splash_screen.dart';
import '../features/branches/presentation/screens/branches_screen.dart';
import '../features/brands/presentation/screens/brands_screen.dart';
import '../features/dashboard/presentation/screens/dashboard_screen.dart';
import '../features/offers/presentation/screens/offers_screen.dart';
import '../features/redemptions/presentation/screens/redemptions_screen.dart';
import '../features/redemptions/presentation/screens/scan_redemption_screen.dart';
import '../features/subscription/presentation/screens/subscription_screen.dart';
import '../features/team/presentation/screens/team_screen.dart';

/// Listens to auth state changes and notifies GoRouter to re-evaluate redirects.
class _AuthListenable extends ChangeNotifier {
  _AuthListenable(Ref ref) {
    ref.listen(authControllerProvider, (_, __) => notifyListeners());
  }
}

final routerProvider = Provider<GoRouter>((ref) {
  final listenable = _AuthListenable(ref);

  return GoRouter(
    initialLocation: '/splash',
    refreshListenable: listenable,
    redirect: (context, state) {
      final auth = ref.read(authControllerProvider);
      final location = state.matchedLocation;

      // Still booting — show splash.
      if (auth.isLoading || auth.hasError && auth.value == null) {
        return location == '/splash' ? null : '/splash';
      }

      final user = auth.value;
      final loggedIn = user != null;

      final atSplash = location == '/splash';
      final atLogin = location == '/login';

      if (!loggedIn) {
        return atLogin ? null : '/login';
      }
      // Logged in but on splash/login — go to dashboard.
      if (atSplash || atLogin) return '/dashboard';
      return null;
    },
    routes: [
      GoRoute(path: '/splash', builder: (_, __) => const SplashScreen()),
      GoRoute(path: '/login', builder: (_, __) => const LoginScreen()),
      GoRoute(path: '/dashboard', builder: (_, __) => const DashboardScreen()),
      GoRoute(path: '/brands', builder: (_, __) => const BrandsScreen()),
      GoRoute(path: '/branches', builder: (_, __) => const BranchesScreen()),
      GoRoute(path: '/offers', builder: (_, __) => const OffersScreen()),
      GoRoute(path: '/team', builder: (_, __) => const TeamScreen()),
      GoRoute(path: '/subscription', builder: (_, __) => const SubscriptionScreen()),
      GoRoute(path: '/redemptions/scan', builder: (_, __) => const ScanRedemptionScreen()),
      GoRoute(path: '/redemptions', builder: (_, __) => const RedemptionsScreen()),
    ],
  );
});
