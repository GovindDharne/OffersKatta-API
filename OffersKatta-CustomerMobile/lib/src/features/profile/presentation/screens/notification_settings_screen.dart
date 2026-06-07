import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/constants/api_constants.dart';
import '../../../../core/di/providers.dart';

/// Lets a customer control their nearby-offer push preferences:
///   • notifyEnabled        — master on/off
///   • notificationRadiusKm — only get pinged within this distance (1–100)
///   • quietHoursEnabled    — suppress push 21:00–09:00 local
///
/// Reads the current values from GET /customers/me and writes changes back to
/// PATCH /customers/me/preferences. Switch toggles save immediately; the radius
/// slider saves on release (debounced) to avoid a request per pixel.
class NotificationSettingsScreen extends ConsumerStatefulWidget {
  const NotificationSettingsScreen({super.key});

  @override
  ConsumerState<NotificationSettingsScreen> createState() => _NotificationSettingsScreenState();
}

class _NotificationSettingsScreenState extends ConsumerState<NotificationSettingsScreen> {
  bool _loading = true;
  String? _error;
  bool _saving = false;

  bool _notifyEnabled = true;
  double _radiusKm = 10;
  bool _quietHours = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final api = ref.read(apiClientProvider);
      final me = await api.get<Map<String, dynamic>>(
        ApiConstants.customersMe,
        decode: (raw) => raw as Map<String, dynamic>,
      );
      final profile = (me['customerProfile'] as Map<String, dynamic>?) ?? const {};
      setState(() {
        _notifyEnabled = profile['notifyEnabled'] as bool? ?? true;
        _radiusKm = ((profile['notificationRadiusKm'] as num?)?.toDouble() ?? 10).clamp(1, 100);
        _quietHours = profile['quietHoursEnabled'] as bool? ?? true;
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _error = '$e';
        _loading = false;
      });
    }
  }

  Future<void> _save({bool? notifyEnabled, int? radiusKm, bool? quietHours}) async {
    setState(() => _saving = true);
    try {
      final api = ref.read(apiClientProvider);
      await api.patch<dynamic>(
        ApiConstants.customersMePreferences,
        body: {
          if (notifyEnabled != null) 'notifyEnabled': notifyEnabled,
          if (radiusKm != null) 'notificationRadiusKm': radiusKm,
          if (quietHours != null) 'quietHoursEnabled': quietHours,
        },
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Could not save: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Notification settings'),
        actions: [
          if (_saving)
            const Padding(
              padding: EdgeInsets.only(right: 16),
              child: Center(
                child: SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2)),
              ),
            ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? _ErrorView(message: _error!, onRetry: _load)
              : ListView(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  children: [
                    SwitchListTile(
                      title: const Text('Nearby offer alerts'),
                      subtitle: const Text('Get a push when a shop near you posts a deal'),
                      value: _notifyEnabled,
                      onChanged: (v) {
                        setState(() => _notifyEnabled = v);
                        _save(notifyEnabled: v);
                      },
                    ),
                    const Divider(height: 1),
                    Opacity(
                      opacity: _notifyEnabled ? 1 : 0.5,
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                const Text('Alert radius'),
                                Text(
                                  '${_radiusKm.round()} km',
                                  style: TextStyle(fontWeight: FontWeight.bold, color: scheme.primary),
                                ),
                              ],
                            ),
                            Slider(
                              min: 1,
                              max: 100,
                              divisions: 99,
                              label: '${_radiusKm.round()} km',
                              value: _radiusKm,
                              onChanged: _notifyEnabled
                                  ? (v) => setState(() => _radiusKm = v)
                                  : null,
                              onChangeEnd: _notifyEnabled
                                  ? (v) => _save(radiusKm: v.round())
                                  : null,
                            ),
                            Text(
                              'Only notify me about shops within this distance.',
                              style: TextStyle(fontSize: 12, color: scheme.onSurfaceVariant),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 8),
                    const Divider(height: 1),
                    SwitchListTile(
                      title: const Text('Quiet hours'),
                      subtitle: const Text('Hold notifications between 9 PM and 9 AM'),
                      value: _quietHours,
                      onChanged: _notifyEnabled
                          ? (v) {
                              setState(() => _quietHours = v);
                              _save(quietHours: v);
                            }
                          : null,
                    ),
                  ],
                ),
    );
  }
}

class _ErrorView extends StatelessWidget {
  const _ErrorView({required this.message, required this.onRetry});
  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline, size: 40),
            const SizedBox(height: 12),
            Text(message, textAlign: TextAlign.center),
            const SizedBox(height: 12),
            FilledButton(onPressed: onRetry, child: const Text('Retry')),
          ],
        ),
      ),
    );
  }
}
