import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:video_player/video_player.dart';

import '../../../../core/utils/formatters.dart';
import '../../../brands/presentation/widgets/follow_brand_button.dart';
import '../../../favorites/presentation/providers/favorites_providers.dart';
import '../../../redemptions/presentation/providers/redemptions_providers.dart';
import '../../../redemptions/presentation/screens/redemption_qr_screen.dart';
import '../../domain/entities/offer.dart';
import '../providers/offers_providers.dart';

class OfferDetailScreen extends ConsumerWidget {
  const OfferDetailScreen({super.key, required this.offerId});
  final String offerId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final offerAsync = ref.watch(offerDetailProvider(offerId));

    return Scaffold(
      appBar: AppBar(title: const Text('Offer')),
      body: offerAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Could not load offer: $e')),
        data: (o) => _OfferDetailBody(offerId: offerId, offer: o),
      ),
    );
  }
}

class _OfferDetailBody extends ConsumerWidget {
  const _OfferDetailBody({required this.offerId, required this.offer});
  final String offerId;
  final Offer offer;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final scheme = Theme.of(context).colorScheme;
    final o = offer;
    final headline = offerHeadline(o.offerType, o.discountValue);
    final stores = o.reachableBranches.isNotEmpty
        ? o.reachableBranches
        : (o.branch != null ? [_branchToReachable(o.branch!)] : const <ReachableBranch>[]);
    final primary = stores.where((s) => s.isPrimary).firstOrNull ??
        (stores.isNotEmpty ? stores.first : null);
    final others = primary == null ? const <ReachableBranch>[] : stores.where((s) => s.id != primary.id).toList();

    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _OfferMediaGallery(
            images: o.images,
            videoUrl: o.videoUrl,
            fallbackHeadline: headline,
          ),
          Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _TitleBlock(offer: o, headline: headline),
                const SizedBox(height: 20),
                _RedeemCard(offer: o, offerId: offerId),
                if (o.description != null || o.descriptionRegional != null) ...[
                  const SizedBox(height: 16),
                  _SectionCard(
                    title: 'About this offer',
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (o.description != null)
                          Text(o.description!, style: TextStyle(color: scheme.onSurfaceVariant)),
                        if (o.descriptionRegional != null) ...[
                          if (o.description != null) const SizedBox(height: 8),
                          Text(o.descriptionRegional!,
                              style: TextStyle(color: scheme.onSurfaceVariant)),
                        ],
                      ],
                    ),
                  ),
                ],
                if (o.termsAndConditions != null) ...[
                  const SizedBox(height: 16),
                  _SectionCard(
                    title: 'Terms & conditions',
                    child: Text(o.termsAndConditions!,
                        style: TextStyle(color: scheme.onSurfaceVariant)),
                  ),
                ],
                if (o.applicableProducts != null || o.excludedProducts != null) ...[
                  const SizedBox(height: 16),
                  _SectionCard(
                    title: 'Products',
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (o.applicableProducts != null)
                          _LabeledRow(label: 'Applies to: ', body: o.applicableProducts!),
                        if (o.excludedProducts != null) ...[
                          if (o.applicableProducts != null) const SizedBox(height: 6),
                          _LabeledRow(label: 'Excluded: ', body: o.excludedProducts!),
                        ],
                      ],
                    ),
                  ),
                ],
                if (o.isRecurring) ...[
                  const SizedBox(height: 16),
                  _SectionCard(
                    title: 'When',
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          _describeRecurring(o.recurringDays, o.recurringStartTime, o.recurringEndTime),
                          style: const TextStyle(fontWeight: FontWeight.w600),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'Within validity: ${formatDate(o.startsAt)} – ${formatDate(o.expiresAt)}',
                          style: TextStyle(fontSize: 12, color: scheme.onSurfaceVariant),
                        ),
                      ],
                    ),
                  ),
                ],
                if (o.cardOffers.isNotEmpty) ...[
                  const SizedBox(height: 16),
                  _CardOffersSection(offers: o.cardOffers),
                ],
                if (o.platforms.isNotEmpty) ...[
                  const SizedBox(height: 16),
                  _PlatformsSection(platforms: o.platforms),
                ],
                if (primary != null) ...[
                  const SizedBox(height: 16),
                  _LocationCard(primary: primary, others: others, categories: o.categories),
                ],
                const SizedBox(height: 24),
              ],
            ),
          ),
        ],
      ),
    );
  }

  ReachableBranch _branchToReachable(BranchSummary b) => ReachableBranch(
        id: b.id,
        name: b.name,
        isPrimary: true,
        addressLine1: b.addressLine1,
        addressLine2: b.addressLine2,
        city: b.city,
        state: b.state,
        postalCode: b.postalCode,
        phone: b.phone,
        latitude: b.latitude,
        longitude: b.longitude,
      );
}

// ──────────────────────────────────────────────────────────────────────
// Media gallery — images + video, with chevrons, counter, thumb strip.
// ──────────────────────────────────────────────────────────────────────

class _MediaItem {
  const _MediaItem.image(this.src) : kind = 'image';
  const _MediaItem.video(this.src) : kind = 'video';
  final String kind; // 'image' | 'video'
  final String src;
}

class _OfferMediaGallery extends StatefulWidget {
  const _OfferMediaGallery({
    required this.images,
    required this.videoUrl,
    required this.fallbackHeadline,
  });

  final List<String> images;
  final String? videoUrl;
  final String fallbackHeadline;

  @override
  State<_OfferMediaGallery> createState() => _OfferMediaGalleryState();
}

class _OfferMediaGalleryState extends State<_OfferMediaGallery> {
  late final PageController _controller = PageController();
  int _index = 0;

  List<_MediaItem> get _items {
    final out = <_MediaItem>[];
    for (final img in widget.images) {
      out.add(_MediaItem.image(img));
    }
    if (widget.videoUrl != null && widget.videoUrl!.isNotEmpty) {
      out.add(_MediaItem.video(widget.videoUrl!));
    }
    return out;
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final items = _items;

    if (items.isEmpty) {
      return AspectRatio(
        aspectRatio: 16 / 9,
        child: Container(
          color: scheme.primaryContainer,
          alignment: Alignment.center,
          child: Text(
            widget.fallbackHeadline,
            style: TextStyle(
              fontSize: 40,
              fontWeight: FontWeight.bold,
              color: scheme.onPrimaryContainer,
            ),
          ),
        ),
      );
    }

    return Column(
      children: [
        AspectRatio(
          aspectRatio: 16 / 9,
          child: Stack(
            fit: StackFit.expand,
            children: [
              Container(color: Colors.black),
              PageView.builder(
                controller: _controller,
                itemCount: items.length,
                onPageChanged: (i) => setState(() => _index = i),
                itemBuilder: (_, i) => _MediaTile(item: items[i], headline: widget.fallbackHeadline),
              ),
              if (items.length > 1) ...[
                Positioned(
                  left: 8,
                  top: 0,
                  bottom: 0,
                  child: Center(child: _NavButton(icon: Icons.chevron_left, onTap: _prev)),
                ),
                Positioned(
                  right: 8,
                  top: 0,
                  bottom: 0,
                  child: Center(child: _NavButton(icon: Icons.chevron_right, onTap: _next)),
                ),
                Positioned(
                  right: 8,
                  bottom: 8,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      color: Colors.black.withValues(alpha: 0.55),
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text(
                      '${_index + 1} / ${items.length}',
                      style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600),
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
        if (items.length > 1)
          SizedBox(
            height: 72,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
              itemCount: items.length,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (_, i) => _Thumb(
                item: items[i],
                active: i == _index,
                onTap: () {
                  setState(() => _index = i);
                  _controller.animateToPage(i,
                      duration: const Duration(milliseconds: 200), curve: Curves.easeOut);
                },
              ),
            ),
          ),
      ],
    );
  }

  void _prev() {
    final next = (_index - 1) % _items.length;
    final wrapped = next < 0 ? _items.length - 1 : next;
    _controller.animateToPage(wrapped, duration: const Duration(milliseconds: 200), curve: Curves.easeOut);
  }

  void _next() {
    final wrapped = (_index + 1) % _items.length;
    _controller.animateToPage(wrapped, duration: const Duration(milliseconds: 200), curve: Curves.easeOut);
  }
}

class _NavButton extends StatelessWidget {
  const _NavButton({required this.icon, required this.onTap});
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.black.withValues(alpha: 0.55),
      shape: const CircleBorder(),
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(8),
          child: Icon(icon, color: Colors.white, size: 22),
        ),
      ),
    );
  }
}

class _MediaTile extends StatelessWidget {
  const _MediaTile({required this.item, required this.headline});
  final _MediaItem item;
  final String headline;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    if (item.kind == 'video') {
      return _VideoPlayerTile(url: resolveAssetUrl(item.src)!);
    }
    return Image.network(
      resolveAssetUrl(item.src)!,
      fit: BoxFit.contain,
      loadingBuilder: (ctx, child, progress) {
        if (progress == null) return child;
        return const Center(
          child: SizedBox(
            width: 28, height: 28,
            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
          ),
        );
      },
      errorBuilder: (_, __, ___) => Container(
        color: scheme.primaryContainer,
        alignment: Alignment.center,
        child: Text(headline,
            style: TextStyle(
                color: scheme.onPrimaryContainer, fontSize: 32, fontWeight: FontWeight.bold)),
      ),
    );
  }
}

/// Inline video player for the gallery. Stays as a tap-to-load poster until
/// the user actually wants to play (avoids pre-fetching big video bytes for
/// users who only scroll the photos), then initialises the controller, mutes
/// autoplay so it never surprises the user, and renders simple play/pause +
/// scrubber controls. Disposes the controller on widget removal so we don't
/// leak the native player when the user leaves the page.
class _VideoPlayerTile extends StatefulWidget {
  const _VideoPlayerTile({required this.url});
  final String url;

  @override
  State<_VideoPlayerTile> createState() => _VideoPlayerTileState();
}

class _VideoPlayerTileState extends State<_VideoPlayerTile> {
  VideoPlayerController? _controller;
  bool _initializing = false;
  Object? _error;
  bool _showControls = true;

  @override
  void dispose() {
    _controller?.dispose();
    super.dispose();
  }

  Future<void> _start() async {
    if (_controller != null || _initializing) return;
    setState(() {
      _initializing = true;
      _error = null;
    });
    final c = VideoPlayerController.networkUrl(Uri.parse(widget.url));
    try {
      await c.initialize();
      await c.setLooping(false);
      await c.setVolume(1.0);
      await c.play();
      if (!mounted) {
        await c.dispose();
        return;
      }
      setState(() {
        _controller = c;
        _initializing = false;
      });
      // Auto-hide the controls after a couple of seconds while playing.
      _scheduleHideControls();
    } catch (e) {
      await c.dispose();
      if (!mounted) return;
      setState(() {
        _initializing = false;
        _error = e;
      });
    }
  }

  void _scheduleHideControls() {
    Future<void>.delayed(const Duration(seconds: 2), () {
      if (!mounted) return;
      if (_controller != null && _controller!.value.isPlaying) {
        setState(() => _showControls = false);
      }
    });
  }

  void _togglePlayPause() {
    final c = _controller;
    if (c == null) return;
    setState(() {
      if (c.value.isPlaying) {
        c.pause();
        _showControls = true;
      } else {
        c.play();
        _showControls = true;
        _scheduleHideControls();
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    // Pre-play state: black poster with a big play button.
    if (_controller == null) {
      return GestureDetector(
        onTap: _initializing ? null : _start,
        child: Stack(
          alignment: Alignment.center,
          children: [
            Container(color: Colors.black),
            if (_initializing)
              const SizedBox(
                width: 36,
                height: 36,
                child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
              )
            else
              const Icon(Icons.play_circle_fill, color: Colors.white, size: 80),
            if (_error != null)
              Positioned(
                bottom: 12,
                left: 12,
                right: 12,
                child: Text(
                  'Could not load video: $_error',
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: Colors.white, fontSize: 12),
                ),
              )
            else if (!_initializing)
              const Positioned(
                bottom: 12,
                child: Text(
                  'Tap to play',
                  style: TextStyle(color: Colors.white70, fontSize: 12),
                ),
              ),
          ],
        ),
      );
    }

    // Player is ready — fit to the 16:9 viewport and show simple controls.
    final c = _controller!;
    return GestureDetector(
      onTap: () => setState(() {
        _showControls = !_showControls;
        if (_showControls && c.value.isPlaying) _scheduleHideControls();
      }),
      behavior: HitTestBehavior.opaque,
      child: Stack(
        fit: StackFit.expand,
        children: [
          Container(color: Colors.black),
          Center(
            child: AspectRatio(
              aspectRatio: c.value.aspectRatio,
              child: VideoPlayer(c),
            ),
          ),
          if (_showControls) ...[
            // Centre play/pause toggle button.
            Center(
              child: Material(
                color: Colors.black.withValues(alpha: 0.55),
                shape: const CircleBorder(),
                child: InkWell(
                  customBorder: const CircleBorder(),
                  onTap: _togglePlayPause,
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Icon(
                      c.value.isPlaying ? Icons.pause : Icons.play_arrow,
                      color: Colors.white,
                      size: 36,
                    ),
                  ),
                ),
              ),
            ),
            // Bottom: scrubber + time.
            Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              child: Container(
                padding: const EdgeInsets.fromLTRB(12, 0, 12, 6),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.bottomCenter,
                    end: Alignment.topCenter,
                    colors: [Colors.black.withValues(alpha: 0.55), Colors.transparent],
                  ),
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    VideoProgressIndicator(
                      c,
                      allowScrubbing: true,
                      colors: const VideoProgressColors(
                        playedColor: Colors.white,
                        bufferedColor: Colors.white24,
                        backgroundColor: Colors.white10,
                      ),
                      padding: const EdgeInsets.symmetric(vertical: 8),
                    ),
                    ValueListenableBuilder<VideoPlayerValue>(
                      valueListenable: c,
                      builder: (_, v, __) => Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(_fmtDuration(v.position),
                              style: const TextStyle(color: Colors.white, fontSize: 11)),
                          Text(_fmtDuration(v.duration),
                              style: const TextStyle(color: Colors.white70, fontSize: 11)),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

String _fmtDuration(Duration d) {
  String two(int n) => n.toString().padLeft(2, '0');
  final h = d.inHours;
  final m = d.inMinutes.remainder(60);
  final s = d.inSeconds.remainder(60);
  return h > 0 ? '$h:${two(m)}:${two(s)}' : '${two(m)}:${two(s)}';
}

class _Thumb extends StatelessWidget {
  const _Thumb({required this.item, required this.active, required this.onTap});
  final _MediaItem item;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final border = active
        ? Border.all(color: scheme.primary, width: 2)
        : Border.all(color: scheme.outlineVariant);
    return InkWell(
      borderRadius: BorderRadius.circular(6),
      onTap: onTap,
      child: Container(
        width: 96,
        height: 60,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(6),
          border: border,
        ),
        clipBehavior: Clip.antiAlias,
        child: item.kind == 'video'
            ? Container(
                color: Colors.black,
                alignment: Alignment.center,
                child: const Icon(Icons.play_arrow, color: Colors.white, size: 24),
              )
            : Image.network(
                resolveAssetUrl(item.src)!,
                fit: BoxFit.cover,
                errorBuilder: (_, __, ___) => Container(color: scheme.surfaceContainerHighest),
              ),
      ),
    );
  }
}

// ──────────────────────────────────────────────────────────────────────
// Title block (badges + title + brand + chips + tags)
// ──────────────────────────────────────────────────────────────────────

class _TitleBlock extends StatelessWidget {
  const _TitleBlock({required this.offer, required this.headline});
  final Offer offer;
  final String headline;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final o = offer;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (o.isFeatured)
          Container(
            margin: const EdgeInsets.only(bottom: 8),
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(color: scheme.primary, borderRadius: BorderRadius.circular(999)),
            child: Text('Featured',
                style: TextStyle(color: scheme.onPrimary, fontSize: 11, fontWeight: FontWeight.w600)),
          ),
        Text(o.title,
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold)),
        if (o.titleHindi != null) ...[
          const SizedBox(height: 4),
          Text(o.titleHindi!,
              style: Theme.of(context).textTheme.titleMedium?.copyWith(color: scheme.onSurfaceVariant)),
        ],
        if (o.branch?.brandName != null) ...[
          const SizedBox(height: 6),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              Text('by ${o.branch!.brandName!}', style: TextStyle(color: scheme.onSurfaceVariant)),
              if (o.branch!.brandId != null)
                FollowBrandButton(
                  brandId: o.branch!.brandId!,
                  brandName: o.branch!.brandName!,
                ),
            ],
          ),
        ],
        const SizedBox(height: 10),
        Wrap(
          spacing: 6,
          runSpacing: 6,
          children: [
            _Chip(icon: Icons.local_offer_outlined, label: headline),
            _Chip(icon: Icons.qr_code, label: '${o.totalRedemptions} redeemed'),
            _Chip(icon: Icons.visibility_outlined, label: '${o.viewCount} views'),
            _Chip(icon: Icons.calendar_today_outlined, label: 'until ${formatDate(o.expiresAt)}'),
            if (o.visibility != null && o.visibility != 'PUBLIC')
              _Chip(icon: Icons.lock_outline, label: _visibilityLabel(o.visibility!)),
            if (o.isStackable) const _Chip(icon: Icons.layers_outlined, label: 'Combinable'),
            if (o.isExpired)
              const _Chip(
                  icon: Icons.event_busy_outlined, label: 'Expired', tone: _ChipTone.danger),
          ],
        ),
        if (o.tags.isNotEmpty) ...[
          const SizedBox(height: 8),
          Wrap(
            spacing: 4,
            runSpacing: 4,
            children: o.tags
                .map((t) => Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                        color: scheme.surfaceContainerHighest,
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Text('#$t',
                          style: TextStyle(fontSize: 11, color: scheme.onSurfaceVariant)),
                    ))
                .toList(growable: false),
          ),
        ],
      ],
    );
  }

  String _visibilityLabel(String v) {
    switch (v) {
      case 'MEMBERS':
        return 'Members only';
      case 'NEW_CUSTOMERS':
        return 'New customers';
      case 'REFERRAL':
        return 'Referral only';
      default:
        return 'Public';
    }
  }
}

// ──────────────────────────────────────────────────────────────────────
// Redeem card (coupon, Get QR, Save, Share)
// ──────────────────────────────────────────────────────────────────────

class _RedeemCard extends ConsumerWidget {
  const _RedeemCard({required this.offer, required this.offerId});
  final Offer offer;
  final String offerId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final scheme = Theme.of(context).colorScheme;
    final o = offer;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Redeem',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
            const SizedBox(height: 4),
            Text(
              'Valid ${formatDate(o.startsAt)} – ${formatDate(o.expiresAt)}',
              style: TextStyle(fontSize: 12, color: scheme.onSurfaceVariant),
            ),
            if (o.couponCode != null) ...[
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 12),
                decoration: BoxDecoration(
                  color: scheme.surfaceContainerHighest,
                  border: Border.all(color: scheme.outlineVariant, style: BorderStyle.solid),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Column(
                  children: [
                    Text('Use coupon code',
                        style: TextStyle(fontSize: 11, color: scheme.onSurfaceVariant)),
                    const SizedBox(height: 2),
                    Text(o.couponCode!,
                        style: const TextStyle(
                            fontWeight: FontWeight.bold, fontSize: 18, letterSpacing: 1.2)),
                  ],
                ),
              ),
            ],
            const SizedBox(height: 12),
            FilledButton.icon(
              onPressed: o.isActive
                  ? () async {
                      final messenger = ScaffoldMessenger.of(context);
                      try {
                        final issued = await ref
                            .read(redemptionsControllerProvider.notifier)
                            .issueFor(offerId);
                        if (context.mounted) {
                          showDialog<void>(
                            context: context,
                            builder: (_) => RedemptionQrDialog(redemption: issued),
                          );
                        }
                      } catch (e) {
                        messenger.showSnackBar(SnackBar(content: Text(e.toString())));
                      }
                    }
                  : null,
              icon: const Icon(Icons.qr_code),
              label: const Text('Get my QR'),
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () async {
                      final messenger = ScaffoldMessenger.of(context);
                      try {
                        await ref.read(favoritesControllerProvider.notifier).add(offerId);
                        messenger.showSnackBar(
                          const SnackBar(content: Text('Saved to favorites')),
                        );
                      } catch (e) {
                        messenger.showSnackBar(SnackBar(content: Text(e.toString())));
                      }
                    },
                    icon: const Icon(Icons.favorite_border),
                    label: const Text('Save'),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Builder(
                    builder: (ctx) => OutlinedButton.icon(
                      onPressed: () => _shareOffer(ctx, ref, o),
                      icon: const Icon(Icons.share_outlined),
                      label: const Text('Share'),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  /// Opens the OS share sheet (WhatsApp, SMS, mail, copy link, etc.) with the
  /// offer's title and a deep link to its detail page on the web. Also
  /// fire-and-forget POSTs to `/offers/:id/share` so the share counter ticks
  /// up — mirrors what the website does.
  Future<void> _shareOffer(BuildContext context, WidgetRef ref, Offer o) async {
    final url = _shareUrl(o.id);
    final text = '${o.title}\n$url';
    // Anchor for the iPad share popover; harmless on other platforms.
    final box = context.findRenderObject() as RenderBox?;
    final origin = box != null ? box.localToGlobal(Offset.zero) & box.size : null;
    unawaited(
      ref.read(offersRepositoryProvider).trackShare(o.id).catchError((_) {}),
    );
    await Share.share(text, subject: o.title, sharePositionOrigin: origin);
  }

  String _shareUrl(String id) {
    // Reuse the API base host as the web origin — the public site lives on
    // the same host as the API. Falls back to just the path when no host is
    // resolvable so the receiver still sees something useful.
    final resolved = resolveAssetUrl('/offers/$id');
    return resolved ?? '/offers/$id';
  }
}

// ──────────────────────────────────────────────────────────────────────
// Card-offers section
// ──────────────────────────────────────────────────────────────────────

class _CardOffersSection extends StatelessWidget {
  const _CardOffersSection({required this.offers});
  final List<OfferCardOffer> offers;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    // Group by bankId.
    final byBank = <String, List<OfferCardOffer>>{};
    for (final c in offers) {
      byBank.putIfAbsent(c.bankId, () => []).add(c);
    }
    final groups = byBank.entries.toList()
      ..sort((a, b) => a.value.first.bankName.compareTo(b.value.first.bankName));
    return _SectionCard(
      title: 'Card offers',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (final g in groups) ...[
            Text(g.value.first.bankName,
                style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
            const SizedBox(height: 4),
            for (final c in g.value)
              Padding(
                padding: const EdgeInsets.only(left: 4, bottom: 4),
                child: Text.rich(
                  TextSpan(
                    children: [
                      TextSpan(
                        text: c.cardName,
                        style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                            color: scheme.onSurface),
                      ),
                      if (c.benefitValue != null || c.benefitType != null)
                        TextSpan(
                          text:
                              ' — ${[c.benefitValue, c.benefitType].whereType<String>().join(' ')}',
                          style: TextStyle(fontSize: 12, color: scheme.onSurfaceVariant),
                        ),
                      if (c.minSpend != null)
                        TextSpan(
                          text: ' · min spend ₹${c.minSpend!.toStringAsFixed(0)}',
                          style: TextStyle(fontSize: 12, color: scheme.onSurfaceVariant),
                        ),
                      if (c.maxBenefit != null)
                        TextSpan(
                          text: ' · up to ₹${c.maxBenefit!.toStringAsFixed(0)}',
                          style: TextStyle(fontSize: 12, color: scheme.onSurfaceVariant),
                        ),
                    ],
                  ),
                ),
              ),
            const SizedBox(height: 8),
          ],
        ],
      ),
    );
  }
}

// ──────────────────────────────────────────────────────────────────────
// Platforms section
// ──────────────────────────────────────────────────────────────────────

class _PlatformsSection extends StatelessWidget {
  const _PlatformsSection({required this.platforms});
  final List<OfferPlatform> platforms;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return _SectionCard(
      title: 'Also available online',
      child: Wrap(
        spacing: 8,
        runSpacing: 8,
        children: platforms.map((p) {
          final chip = Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              border: Border.all(color: scheme.outlineVariant),
              borderRadius: BorderRadius.circular(999),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(p.platformName, style: const TextStyle(fontSize: 12)),
                if (p.url != null) ...[
                  const SizedBox(width: 4),
                  const Icon(Icons.open_in_new, size: 12),
                ],
              ],
            ),
          );
          if (p.url == null) return chip;
          return InkWell(
            borderRadius: BorderRadius.circular(999),
            onTap: () => _launchExternal(p.url),
            child: chip,
          );
        }).toList(growable: false),
      ),
    );
  }
}

// ──────────────────────────────────────────────────────────────────────
// Location card — primary store + directions/map + other reachable stores
// ──────────────────────────────────────────────────────────────────────

class _LocationCard extends StatelessWidget {
  const _LocationCard({
    required this.primary,
    required this.others,
    required this.categories,
  });

  final ReachableBranch primary;
  final List<ReachableBranch> others;
  final List<OfferCategoryRef> categories;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final title = others.isEmpty ? 'Location' : 'Available at ${others.length + 1} stores';
    final addr = [primary.addressLine1, primary.addressLine2, primary.city, primary.state, primary.postalCode]
        .where((s) => s != null && s.isNotEmpty)
        .join(', ');
    final hasLatLng = primary.latitude != null && primary.longitude != null;
    return _SectionCard(
      title: title,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(primary.name, style: const TextStyle(fontWeight: FontWeight.w600)),
          if (addr.isNotEmpty) ...[
            const SizedBox(height: 4),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(Icons.place_outlined, size: 14, color: scheme.onSurfaceVariant),
                const SizedBox(width: 4),
                Expanded(
                  child: Text(addr, style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 13)),
                ),
              ],
            ),
          ],
          if (primary.phone != null) ...[
            const SizedBox(height: 4),
            InkWell(
              onTap: () => _launchExternal('tel:${primary.phone}'),
              child: Row(
                children: [
                  Icon(Icons.phone_outlined, size: 14, color: scheme.onSurfaceVariant),
                  const SizedBox(width: 4),
                  Text(primary.phone!, style: TextStyle(color: scheme.primary, fontSize: 13)),
                ],
              ),
            ),
          ],
          if (hasLatLng) ...[
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: () => _launchExternal(_directionsUrl(primary.latitude!, primary.longitude!)),
                icon: const Icon(Icons.navigation_outlined),
                label: const Text('Get directions'),
              ),
            ),
            const SizedBox(height: 6),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: () => _launchExternal(
                    _mapPreviewUrl(primary.latitude!, primary.longitude!, primary.name)),
                icon: const Icon(Icons.map_outlined),
                label: const Text('View on map'),
              ),
            ),
            const SizedBox(height: 4),
            Center(
              child: Text(
                '${primary.latitude!.toStringAsFixed(5)}, ${primary.longitude!.toStringAsFixed(5)}',
                style: TextStyle(fontSize: 11, color: scheme.onSurfaceVariant),
              ),
            ),
          ],
          if (others.isNotEmpty) ...[
            const SizedBox(height: 12),
            const Divider(height: 1),
            const SizedBox(height: 8),
            Text(
              'Also at ${others.length} more ${others.length == 1 ? 'store' : 'stores'}',
              style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 12),
            ),
            const SizedBox(height: 4),
            for (final s in others)
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(s.name, style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 13)),
                          Text(
                            [s.addressLine1, s.city, s.state].where((x) => x != null && x.isNotEmpty).join(', '),
                            style: TextStyle(fontSize: 11, color: scheme.onSurfaceVariant),
                          ),
                        ],
                      ),
                    ),
                    if (s.latitude != null && s.longitude != null)
                      TextButton.icon(
                        onPressed: () => _launchExternal(_directionsUrl(s.latitude!, s.longitude!)),
                        icon: const Icon(Icons.navigation_outlined, size: 14),
                        label: const Text('Directions', style: TextStyle(fontSize: 12)),
                        style: TextButton.styleFrom(visualDensity: VisualDensity.compact),
                      ),
                  ],
                ),
              ),
          ],
          if (categories.isNotEmpty) ...[
            const SizedBox(height: 12),
            const Divider(height: 1),
            const SizedBox(height: 8),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: categories
                  .map((c) => Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          border: Border.all(color: scheme.outlineVariant),
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: Text(c.name, style: const TextStyle(fontSize: 11)),
                      ))
                  .toList(growable: false),
            ),
          ],
        ],
      ),
    );
  }
}

// ──────────────────────────────────────────────────────────────────────
// Shared small bits
// ──────────────────────────────────────────────────────────────────────

class _SectionCard extends StatelessWidget {
  const _SectionCard({required this.title, required this.child});
  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title,
                style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
            const SizedBox(height: 8),
            child,
          ],
        ),
      ),
    );
  }
}

enum _ChipTone { neutral, danger }

class _Chip extends StatelessWidget {
  const _Chip({required this.icon, required this.label, this.tone = _ChipTone.neutral});
  final IconData icon;
  final String label;
  final _ChipTone tone;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final bg = tone == _ChipTone.danger ? scheme.errorContainer : scheme.secondaryContainer;
    final fg = tone == _ChipTone.danger ? scheme.onErrorContainer : scheme.onSecondaryContainer;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(999)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: fg),
          const SizedBox(width: 6),
          Text(label, style: TextStyle(color: fg, fontSize: 12)),
        ],
      ),
    );
  }
}

class _LabeledRow extends StatelessWidget {
  const _LabeledRow({required this.label, required this.body});
  final String label;
  final String body;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Text.rich(
      TextSpan(
        children: [
          TextSpan(text: label, style: const TextStyle(fontWeight: FontWeight.w600)),
          TextSpan(text: body, style: TextStyle(color: scheme.onSurfaceVariant)),
        ],
      ),
    );
  }
}

// ──────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────

/// Open a URL in an external app (browser, maps, dialer, etc.).
///
/// Don't gate on `canLaunchUrl` — on Android 11+ that requires every URL
/// scheme to be listed under `<queries>` in AndroidManifest.xml, and it
/// silently returns false otherwise. We just attempt the launch and let it
/// throw if no app can handle it (then we swallow so the UI isn't broken).
Future<void> _launchExternal(String? url) async {
  if (url == null || url.isEmpty) return;
  final uri = Uri.tryParse(url);
  if (uri == null) return;
  try {
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  } catch (_) {
    // No installed app handled the URL; nothing useful to do from here.
  }
}

String _directionsUrl(double lat, double lng) =>
    'https://www.google.com/maps/dir/?api=1&destination=$lat,$lng';

String _mapPreviewUrl(double lat, double lng, String label) =>
    'https://www.google.com/maps/search/?api=1&query=$lat,$lng(${Uri.encodeComponent(label)})';

const _weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

String _describeRecurring(List<int> days, String? start, String? end) {
  final time = (start != null && end != null) ? '${_fmtTime(start)} – ${_fmtTime(end)}' : 'All day';
  final d = [...days]..sort();
  if (d.isEmpty || d.length == 7) return 'Daily, $time';
  // Detect contiguous run treating Sunday as 7 so Sat+Sun reads as a range.
  final norm = d.map((x) => x == 0 ? 7 : x).toList()..sort();
  final contiguous = List.generate(norm.length - 1, (i) => norm[i + 1] - norm[i]).every((g) => g == 1);
  if (contiguous && norm.length >= 2) {
    final first = norm.first == 7 ? 0 : norm.first;
    final last = norm.last == 7 ? 0 : norm.last;
    return '${_weekdays[first]}–${_weekdays[last]}, $time';
  }
  return '${d.map((x) => _weekdays[x]).join(', ')}, $time';
}

String _fmtTime(String hhmm) {
  final parts = hhmm.split(':');
  if (parts.length != 2) return hhmm;
  final h = int.tryParse(parts[0]) ?? 0;
  final m = int.tryParse(parts[1]) ?? 0;
  final period = h >= 12 ? 'PM' : 'AM';
  final h12 = h == 0 ? 12 : (h > 12 ? h - 12 : h);
  return '$h12:${m.toString().padLeft(2, '0')} $period';
}
