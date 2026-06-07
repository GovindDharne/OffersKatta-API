import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/constants/api_constants.dart';
import '../../../../core/di/providers.dart';
import '../../domain/entities/offer.dart';

/// Bottom-sheet "notify nearby customers" flow. Mirrors the admin web dialog:
/// pick a radius + audience, POST /push/offer/:id, then poll the job until the
/// counters fill in. No payment — this is a free seller action (rate-limited
/// server-side by the per-day frequency caps).
Future<void> showNotifySheet(BuildContext context, {required Offer offer}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    builder: (_) => Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: _NotifySheet(offer: offer),
    ),
  );
}

enum _Audience { nearby, followers, both }

extension on _Audience {
  String get api => switch (this) {
        _Audience.nearby => 'NEARBY',
        _Audience.followers => 'FOLLOWERS',
        _Audience.both => 'BOTH',
      };
  String get label => switch (this) {
        _Audience.nearby => 'Nearby customers',
        _Audience.followers => 'Brand followers',
        _Audience.both => 'Both',
      };
}

class _NotifySheet extends ConsumerStatefulWidget {
  const _NotifySheet({required this.offer});
  final Offer offer;

  @override
  ConsumerState<_NotifySheet> createState() => _NotifySheetState();
}

class _NotifySheetState extends ConsumerState<_NotifySheet> {
  double _radiusKm = 5;
  _Audience _audience = _Audience.both;
  bool _sending = false;
  String? _error;
  String? _resultText;

  Future<void> _send() async {
    setState(() {
      _sending = true;
      _error = null;
      _resultText = null;
    });
    try {
      final api = ref.read(apiClientProvider);
      final res = await api.post<Map<String, dynamic>>(
        ApiConstants.pushOffer(widget.offer.id),
        body: {'radiusKm': _radiusKm.round(), 'audience': _audience.api},
        decode: (raw) => (raw as Map<String, dynamic>?) ?? const {},
      );
      final jobId = res['jobId'] as String?;
      if (jobId == null) {
        // Some deployments process synchronously and return counts directly.
        setState(() {
          _resultText = _format(res);
          _sending = false;
        });
        return;
      }
      // Poll the job up to ~30s for the worker to finish.
      Map<String, dynamic>? job;
      for (var i = 0; i < 20; i++) {
        await Future<void>.delayed(const Duration(milliseconds: 1500));
        job = await api.get<Map<String, dynamic>>(
          ApiConstants.pushJob(jobId),
          decode: (raw) => (raw as Map<String, dynamic>?) ?? const {},
        );
        final status = job['status'] as String?;
        if (status == 'COMPLETED' || status == 'FAILED') break;
      }
      if (!mounted) return;
      if (job != null && job['status'] == 'FAILED') {
        setState(() {
          _error = (job!['errorMessage'] as String?) ?? 'Push job failed';
          _sending = false;
        });
      } else if (job != null && job['status'] == 'COMPLETED') {
        setState(() {
          _resultText = _format(job!);
          _sending = false;
        });
      } else {
        setState(() {
          _resultText = 'Still processing — check back in a minute.';
          _sending = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = '$e';
          _sending = false;
        });
      }
    }
  }

  String _format(Map<String, dynamic> j) {
    int n(String k) => (j[k] as num?)?.toInt() ?? (j['recipients${_cap(k)}'] as num?)?.toInt() ?? 0;
    final sent = n('sent');
    final capped = n('capped');
    final deferred = n('deferred');
    final failed = n('failed');
    return 'Sent $sent · capped $capped · quiet-hours $deferred · failed $failed';
  }

  String _cap(String s) => s.isEmpty ? s : '${s[0].toUpperCase()}${s.substring(1)}';

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 16),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(children: [
                Icon(Icons.campaign_outlined, color: scheme.primary),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Notify customers',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close),
                  onPressed: _sending ? null : () => Navigator.of(context).pop(),
                ),
              ]),
              const SizedBox(height: 4),
              Text(
                'Send a push about "${widget.offer.title}".',
                style: Theme.of(context).textTheme.bodySmall,
              ),
              const SizedBox(height: 16),

              // Audience
              Text('Audience', style: Theme.of(context).textTheme.labelLarge),
              const SizedBox(height: 6),
              Wrap(
                spacing: 8,
                children: _Audience.values.map((a) {
                  final sel = _audience == a;
                  return ChoiceChip(
                    label: Text(a.label),
                    selected: sel,
                    onSelected: _sending ? null : (_) => setState(() => _audience = a),
                  );
                }).toList(growable: false),
              ),
              const SizedBox(height: 16),

              // Radius (only meaningful when audience includes nearby)
              Opacity(
                opacity: _audience == _Audience.followers ? 0.5 : 1,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('Radius', style: Theme.of(context).textTheme.labelLarge),
                        Text('${_radiusKm.round()} km',
                            style: TextStyle(fontWeight: FontWeight.bold, color: scheme.primary)),
                      ],
                    ),
                    Slider(
                      min: 1,
                      max: 100,
                      divisions: 99,
                      label: '${_radiusKm.round()} km',
                      value: _radiusKm,
                      onChanged: (_sending || _audience == _Audience.followers)
                          ? null
                          : (v) => setState(() => _radiusKm = v),
                    ),
                  ],
                ),
              ),

              if (_error != null) ...[
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: scheme.errorContainer,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(_error!, style: TextStyle(color: scheme.onErrorContainer)),
                ),
              ],
              if (_resultText != null) ...[
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: scheme.secondaryContainer,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(children: [
                    Icon(Icons.check_circle_outline, size: 18, color: scheme.onSecondaryContainer),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(_resultText!, style: TextStyle(color: scheme.onSecondaryContainer)),
                    ),
                  ]),
                ),
              ],

              const SizedBox(height: 16),
              if (_resultText == null)
                FilledButton.icon(
                  onPressed: _sending ? null : _send,
                  icon: _sending
                      ? const SizedBox(height: 16, width: 16, child: CircularProgressIndicator(strokeWidth: 2))
                      : const Icon(Icons.send),
                  label: Text(_sending ? 'Sending…' : 'Send notification'),
                )
              else
                FilledButton(
                  onPressed: () => Navigator.of(context).pop(),
                  child: const Text('Done'),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
