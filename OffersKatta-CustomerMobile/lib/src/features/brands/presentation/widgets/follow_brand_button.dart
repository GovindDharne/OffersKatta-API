import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/constants/api_constants.dart';
import '../../../../core/di/providers.dart';
import '../../../auth/presentation/providers/auth_providers.dart';

class _FollowStatus {
  const _FollowStatus({required this.following, required this.followerCount});
  final bool following;
  final int followerCount;
}

/// Reads /brands/:id/follow/status for the signed-in customer. Cached per
/// brandId so each visit to an offer detail screen doesn't re-fetch
/// unnecessarily (5 min staleTime is fine — count drift is harmless).
final brandFollowStatusProvider =
    FutureProvider.family.autoDispose<_FollowStatus, String>((ref, brandId) async {
  final api = ref.watch(apiClientProvider);
  final json = await api.get<Map<String, dynamic>>(
    ApiConstants.brandFollowStatus(brandId),
    decode: (raw) => raw as Map<String, dynamic>,
  );
  return _FollowStatus(
    following: json['following'] as bool? ?? false,
    followerCount: (json['followerCount'] as num?)?.toInt() ?? 0,
  );
});

/// Small inline button shown next to the brand name on the offer detail
/// screen. Customer-only — hidden for unauthenticated users (with a hint to
/// log in). Toggle posts/deletes /brands/:id/follow and invalidates the
/// status query so the count refreshes.
class FollowBrandButton extends ConsumerStatefulWidget {
  const FollowBrandButton({
    super.key,
    required this.brandId,
    required this.brandName,
  });

  final String brandId;
  final String brandName;

  @override
  ConsumerState<FollowBrandButton> createState() => _FollowBrandButtonState();
}

class _FollowBrandButtonState extends ConsumerState<FollowBrandButton> {
  bool _busy = false;

  @override
  Widget build(BuildContext context) {
    final isAuth = ref.watch(isAuthenticatedProvider);
    if (!isAuth) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Text(
          'Log in to follow this brand',
          style: TextStyle(
            fontSize: 12,
            color: Theme.of(context).colorScheme.primary,
          ),
        ),
      );
    }
    final statusAsync = ref.watch(brandFollowStatusProvider(widget.brandId));
    return statusAsync.when(
      loading: () => const SizedBox(
        height: 28,
        width: 96,
        child: Center(
          child: SizedBox(
            height: 16, width: 16,
            child: CircularProgressIndicator(strokeWidth: 2),
          ),
        ),
      ),
      error: (_, __) => const SizedBox.shrink(),
      data: (s) {
        final scheme = Theme.of(context).colorScheme;
        return Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            FilledButton.tonalIcon(
              onPressed: _busy ? null : () => _toggle(s.following),
              icon: Icon(
                s.following ? Icons.notifications_off_outlined : Icons.notifications_active_outlined,
                size: 16,
              ),
              label: Text(s.following ? 'Following' : 'Follow'),
              style: FilledButton.styleFrom(
                visualDensity: VisualDensity.compact,
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              ),
            ),
            if (s.followerCount > 0) ...[
              const SizedBox(width: 8),
              Text(
                '${s.followerCount} follower${s.followerCount == 1 ? '' : 's'}',
                style: TextStyle(fontSize: 12, color: scheme.onSurfaceVariant),
              ),
            ],
          ],
        );
      },
    );
  }

  Future<void> _toggle(bool currentlyFollowing) async {
    setState(() => _busy = true);
    try {
      final api = ref.read(apiClientProvider);
      final url = ApiConstants.brandFollow(widget.brandId);
      if (currentlyFollowing) {
        await api.delete<void>(url);
      } else {
        await api.post<void>(url);
      }
      // Force the status to refetch — cheap, single endpoint.
      ref.invalidate(brandFollowStatusProvider(widget.brandId));
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          duration: const Duration(seconds: 2),
          content: Text(
            currentlyFollowing
                ? 'Unfollowed ${widget.brandName}.'
                : 'Following ${widget.brandName} — you\'ll be notified about new offers.',
          ),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Could not update follow: $e')),
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }
}
