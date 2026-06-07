import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../notifications/presentation/providers/notifications_providers.dart';

class AppShell extends ConsumerWidget {
  const AppShell({super.key, required this.child, required this.location});
  final Widget child;
  final String location;

  static const _tabs = [
    (route: '/home',          icon: Icons.home_outlined,           filled: Icons.home,           label: 'Home'),
    (route: '/nearby',        icon: Icons.near_me_outlined,        filled: Icons.near_me,        label: 'Nearby'),
    (route: '/search',        icon: Icons.search_outlined,         filled: Icons.search,         label: 'Search'),
    (route: '/favorites',     icon: Icons.favorite_outline,        filled: Icons.favorite,       label: 'Saved'),
    (route: '/profile',       icon: Icons.person_outline,          filled: Icons.person,         label: 'Me'),
  ];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final index = _indexFor(location);
    final unread = ref.watch(unreadCountProvider).maybeWhen(data: (n) => n, orElse: () => 0);

    return Scaffold(
      body: child,
      bottomNavigationBar: NavigationBar(
        selectedIndex: index,
        onDestinationSelected: (i) => context.go(_tabs[i].route),
        destinations: [
          for (var i = 0; i < _tabs.length; i++)
            NavigationDestination(
              icon: _tabs[i].route == '/profile' && unread > 0
                  ? Badge(label: Text('$unread'), child: Icon(_tabs[i].icon))
                  : Icon(_tabs[i].icon),
              selectedIcon: Icon(_tabs[i].filled),
              label: _tabs[i].label,
            ),
        ],
      ),
    );
  }

  int _indexFor(String location) {
    for (var i = 0; i < _tabs.length; i++) {
      if (location == _tabs[i].route || location.startsWith('${_tabs[i].route}/')) return i;
    }
    return 0;
  }
}
