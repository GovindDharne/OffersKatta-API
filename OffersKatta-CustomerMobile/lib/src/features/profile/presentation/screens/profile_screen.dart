import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../auth/presentation/providers/auth_providers.dart';
import '../../../brands/presentation/screens/my_follows_screen.dart';
import '../../../redemptions/presentation/screens/my_redemptions_screen.dart';
import 'notification_settings_screen.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(currentUserProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Profile')),
      body: user == null
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.fromLTRB(16, 24, 16, 24),
              children: [
                Center(
                  child: CircleAvatar(
                    radius: 36,
                    backgroundColor: Theme.of(context).colorScheme.primaryContainer,
                    child: Text(
                      user.displayName.characters.first.toUpperCase(),
                      style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                Center(
                  child: Text(
                    user.displayName,
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                ),
                Center(
                  child: Text(
                    user.email ?? user.phone ?? '',
                    style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant),
                  ),
                ),
                const SizedBox(height: 24),
                Card(
                  child: Column(
                    children: [
                      ListTile(
                        leading: const Icon(Icons.qr_code_2_outlined),
                        title: const Text('Your redemptions'),
                        trailing: const Icon(Icons.chevron_right),
                        onTap: () => Navigator.of(context).push(
                          MaterialPageRoute(builder: (_) => const MyRedemptionsScreen()),
                        ),
                      ),
                      const Divider(height: 1),
                      ListTile(
                        leading: const Icon(Icons.favorite_outline),
                        title: const Text('Brands you follow'),
                        trailing: const Icon(Icons.chevron_right),
                        onTap: () => Navigator.of(context).push(
                          MaterialPageRoute(builder: (_) => const MyFollowsScreen()),
                        ),
                      ),
                      const Divider(height: 1),
                      ListTile(
                        leading: const Icon(Icons.notifications_outlined),
                        title: const Text('Notifications'),
                        trailing: const Icon(Icons.chevron_right),
                        onTap: () => context.push('/notifications'),
                      ),
                      const Divider(height: 1),
                      ListTile(
                        leading: const Icon(Icons.tune_outlined),
                        title: const Text('Notification settings'),
                        trailing: const Icon(Icons.chevron_right),
                        onTap: () => Navigator.of(context).push(
                          MaterialPageRoute(builder: (_) => const NotificationSettingsScreen()),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                OutlinedButton.icon(
                  onPressed: () async {
                    await ref.read(authControllerProvider.notifier).logout();
                    if (context.mounted) context.go('/login');
                  },
                  icon: const Icon(Icons.logout),
                  label: const Text('Log out'),
                ),
              ],
            ),
    );
  }
}
