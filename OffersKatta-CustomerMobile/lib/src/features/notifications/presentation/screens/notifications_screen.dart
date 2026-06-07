import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/utils/formatters.dart';
import '../providers/notifications_providers.dart';

class NotificationsScreen extends ConsumerWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final list = ref.watch(notificationsProvider);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Notifications'),
        actions: [
          IconButton(
            icon: const Icon(Icons.done_all),
            tooltip: 'Mark all read',
            onPressed: () async {
              await ref.read(markAllReadUseCaseProvider)();
              ref.invalidate(notificationsProvider);
              ref.invalidate(unreadCountProvider);
            },
          ),
        ],
      ),
      body: list.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Could not load: $e')),
        data: (items) {
          if (items.isEmpty) {
            return const Center(child: Text('No notifications yet.'));
          }
          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(notificationsProvider),
            child: ListView.separated(
              padding: const EdgeInsets.symmetric(vertical: 8),
              itemCount: items.length,
              separatorBuilder: (_, __) => const Divider(height: 1),
              itemBuilder: (_, i) {
                final n = items[i];
                return ListTile(
                  leading: Icon(
                    n.isRead ? Icons.notifications_none : Icons.notifications_active,
                    color: n.isRead ? Theme.of(context).colorScheme.onSurfaceVariant : Theme.of(context).colorScheme.primary,
                  ),
                  title: Text(n.title, style: TextStyle(fontWeight: n.isRead ? FontWeight.normal : FontWeight.w600)),
                  subtitle: Text(n.body),
                  trailing: Text(
                    timeAgo(n.createdAt),
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                  onTap: n.isRead ? null : () async {
                    await ref.read(markReadUseCaseProvider)(n.id);
                    ref.invalidate(notificationsProvider);
                    ref.invalidate(unreadCountProvider);
                  },
                );
              },
            ),
          );
        },
      ),
    );
  }
}
