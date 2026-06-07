import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../auth/presentation/providers/auth_providers.dart';

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authControllerProvider).value;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Seller dashboard'),
        actions: [
          IconButton(
            tooltip: 'Log out',
            icon: const Icon(Icons.logout),
            onPressed: () async {
              await ref.read(authControllerProvider.notifier).logout();
            },
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (user != null) _UserCard(user.fullName ?? user.email, user.role),
          const SizedBox(height: 12),
          _NavTile(
            icon: Icons.qr_code_scanner,
            label: 'Scan customer QR',
            sub: 'Confirm a customer\'s redemption at the counter',
            onTap: () => context.go('/redemptions/scan'),
          ),
          _NavTile(
            icon: Icons.receipt_long_outlined,
            label: 'Redemptions',
            sub: 'History per branch — who scanned what, when',
            onTap: () => context.go('/redemptions'),
          ),
          _NavTile(
            icon: Icons.business_outlined,
            label: 'Brands',
            sub: 'Your shops / business names',
            onTap: () => context.go('/brands'),
          ),
          _NavTile(
            icon: Icons.store_outlined,
            label: 'Branches',
            sub: 'Locations & opening hours',
            onTap: () => context.go('/branches'),
          ),
          _NavTile(
            icon: Icons.local_offer_outlined,
            label: 'Offers',
            sub: 'Create, edit, publish',
            onTap: () => context.go('/offers'),
          ),
          _NavTile(
            icon: Icons.group_outlined,
            label: 'Team',
            sub: 'People who can post on your behalf',
            onTap: () => context.go('/team'),
          ),
          const Divider(height: 32),
          _NavTile(
            icon: Icons.workspace_premium_outlined,
            label: 'Subscription',
            sub: 'Choose your plan and pay',
            onTap: () => context.go('/subscription'),
          ),
          _NavTile(
            icon: Icons.rocket_launch_outlined,
            label: 'Boost an offer',
            sub: 'Feature an offer at the top of search & home',
            onTap: () => context.go('/offers'),
          ),
        ],
      ),
    );
  }
}

class _UserCard extends StatelessWidget {
  const _UserCard(this.name, this.role);
  final String name;
  final String role;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        leading: CircleAvatar(
          child: Text(name.substring(0, 1).toUpperCase()),
        ),
        title: Text(name, style: const TextStyle(fontWeight: FontWeight.w600)),
        subtitle: Text(role.replaceAll('_', ' ').toLowerCase()),
      ),
    );
  }
}

class _NavTile extends StatelessWidget {
  const _NavTile({
    required this.icon,
    required this.label,
    required this.sub,
    required this.onTap,
  });
  final IconData icon;
  final String label;
  final String sub;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        leading: Icon(icon),
        title: Text(label, style: const TextStyle(fontWeight: FontWeight.w600)),
        subtitle: Text(sub),
        trailing: const Icon(Icons.chevron_right),
        onTap: onTap,
      ),
    );
  }
}
