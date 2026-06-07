import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../features/auth/presentation/providers/auth_providers.dart';
import '../features/auth/presentation/screens/login_screen.dart';
import '../features/auth/presentation/screens/register_screen.dart';
import '../features/auth/presentation/screens/splash_screen.dart';
import '../features/favorites/presentation/screens/favorites_screen.dart';
import '../features/notifications/presentation/screens/notifications_screen.dart';
import '../features/offers/presentation/screens/home_screen.dart';
import '../features/offers/presentation/screens/nearby_screen.dart';
import '../features/offers/presentation/screens/offer_detail_screen.dart';
import '../features/offers/presentation/screens/search_screen.dart';
import '../features/profile/presentation/screens/profile_screen.dart';
import '../features/shell/presentation/app_shell.dart';

final appRouterProvider = Provider<GoRouter>((ref) {
  final notifier = _AuthRefreshNotifier(ref);
  ref.onDispose(notifier.dispose);

  return GoRouter(
    initialLocation: '/splash',
    refreshListenable: notifier,
    redirect: (context, state) {
      final auth = ref.read(authControllerProvider);
      final location = state.matchedLocation;

      // Splash is transient: shown only while we boot. Once bootstrap finishes
      // we MUST navigate away from it, otherwise the user is stuck on a spinner.
      if (auth.isBootstrapping) {
        return location == '/splash' ? null : '/splash';
      }

      final loggedIn = auth.isAuthenticated;
      final atLoginOrRegister = location == '/login' || location == '/register';
      final atSplash = location == '/splash';

      if (!loggedIn) {
        // Unauthenticated users belong on /login (or /register if they're already there).
        if (atLoginOrRegister) return null;
        return '/login';
      }
      // Authenticated users should never sit on /splash or the auth screens.
      if (atSplash || atLoginOrRegister) return '/home';
      return null;
    },
    routes: [
      GoRoute(path: '/splash', builder: (_, __) => const SplashScreen()),
      GoRoute(path: '/login',  builder: (_, __) => const LoginScreen()),
      GoRoute(path: '/register', builder: (_, __) => const RegisterScreen()),

      ShellRoute(
        builder: (context, state, child) => AppShell(location: state.matchedLocation, child: child),
        routes: [
          GoRoute(path: '/home',     builder: (_, __) => const HomeScreen()),
          GoRoute(path: '/nearby',   builder: (_, __) => const NearbyScreen()),
          GoRoute(
            path: '/search',
            builder: (_, state) => SearchScreen(initialCategoryId: state.uri.queryParameters['categoryId']),
          ),
          GoRoute(path: '/favorites', builder: (_, __) => const FavoritesScreen()),
          GoRoute(path: '/profile',   builder: (_, __) => const ProfileScreen()),
        ],
      ),

      GoRoute(
        path: '/offers/:id',
        builder: (_, state) => OfferDetailScreen(offerId: state.pathParameters['id']!),
      ),
      GoRoute(path: '/notifications', builder: (_, __) => const NotificationsScreen()),
    ],
  );
});

/// Bridges Riverpod auth state to GoRouter so redirects re-evaluate
/// whenever the user logs in or out.
class _AuthRefreshNotifier extends ChangeNotifier {
  _AuthRefreshNotifier(this._ref) {
    _sub = _ref.listen<AuthState>(authControllerProvider, (_, __) => notifyListeners());
  }

  final Ref _ref;
  late final ProviderSubscription<AuthState> _sub;

  @override
  void dispose() {
    _sub.close();
    super.dispose();
  }
}
