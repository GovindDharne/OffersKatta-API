import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';

import '../providers/offers_providers.dart';
import '../widgets/offer_card.dart';

const _fallback = (latitude: 19.0760, longitude: 72.8777); // Mumbai

class NearbyScreen extends ConsumerStatefulWidget {
  const NearbyScreen({super.key});

  @override
  ConsumerState<NearbyScreen> createState() => _NearbyScreenState();
}

class _NearbyScreenState extends ConsumerState<NearbyScreen> {
  double _radius = 10;
  ({double latitude, double longitude})? _coords;
  bool _denied = false;

  @override
  void initState() {
    super.initState();
    _locate();
  }

  Future<void> _locate() async {
    try {
      final allowed = await _ensurePermission();
      if (!allowed) {
        setState(() {
          _denied = true;
          _coords = _fallback;
        });
        return;
      }
      final pos = await Geolocator.getCurrentPosition();
      setState(() => _coords = (latitude: pos.latitude, longitude: pos.longitude));
    } catch (_) {
      setState(() {
        _denied = true;
        _coords = _fallback;
      });
    }
  }

  Future<bool> _ensurePermission() async {
    final enabled = await Geolocator.isLocationServiceEnabled();
    if (!enabled) return false;
    var perm = await Geolocator.checkPermission();
    if (perm == LocationPermission.denied) perm = await Geolocator.requestPermission();
    return perm != LocationPermission.denied && perm != LocationPermission.deniedForever;
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final coords = _coords;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Nearby offers'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _locate,
          ),
        ],
      ),
      body: Column(
        children: [
          // Radius selector
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    coords == null
                        ? 'Locating you...'
                        : 'Within ${_radius.toInt()}km${_denied ? ' (default location)' : ''}',
                    style: TextStyle(color: scheme.onSurfaceVariant),
                  ),
                ),
                for (final r in [5.0, 10.0, 25.0, 50.0])
                  Padding(
                    padding: const EdgeInsets.only(left: 4),
                    child: ChoiceChip(
                      label: Text('${r.toInt()}km'),
                      selected: _radius == r,
                      onSelected: (_) => setState(() => _radius = r),
                    ),
                  ),
              ],
            ),
          ),
          const Divider(height: 1),
          Expanded(
            child: coords == null
                ? const Center(child: CircularProgressIndicator())
                : _ResultsList(
                    args: NearbyArgs(
                      latitude: coords.latitude,
                      longitude: coords.longitude,
                      radiusKm: _radius,
                    ),
                  ),
          ),
        ],
      ),
    );
  }
}

class _ResultsList extends ConsumerWidget {
  const _ResultsList({required this.args});
  final NearbyArgs args;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final result = ref.watch(nearbyOffersProvider(args));
    return result.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(child: Text('Could not load offers: $e')),
      data: (page) {
        if (page.items.isEmpty) {
          return const Center(child: Text('No offers in this radius. Try increasing it.'));
        }
        return RefreshIndicator(
          onRefresh: () async => ref.invalidate(nearbyOffersProvider(args)),
          child: GridView.builder(
            padding: const EdgeInsets.all(12),
            gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
              maxCrossAxisExtent: 280,
              mainAxisExtent: 260,
              crossAxisSpacing: 10,
              mainAxisSpacing: 10,
            ),
            itemCount: page.items.length,
            itemBuilder: (_, i) => OfferCard(offer: page.items[i]),
          ),
        );
      },
    );
  }
}
