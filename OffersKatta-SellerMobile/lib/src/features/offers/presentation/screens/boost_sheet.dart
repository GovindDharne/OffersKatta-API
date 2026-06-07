import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:razorpay_flutter/razorpay_flutter.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../core/constants/api_constants.dart';
import '../../../auth/presentation/providers/auth_providers.dart';
import '../../../payments/data/payments_repository.dart';
import '../../../payments/presentation/providers/payments_providers.dart';
import '../../domain/entities/offer.dart';
import '../providers/offers_providers.dart';

/// Bottom-sheet boost flow. Shows the tier picker, kicks off an order, opens
/// Razorpay Checkout (native on Android/iOS; on web we fall back to the panel
/// since the Flutter SDK doesn't run in the browser).
///
/// Pops `true` if a payment was completed + verified.
Future<bool?> showBoostSheet(BuildContext context, {required Offer offer, required String brandId}) {
  return showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    builder: (_) => Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: _BoostSheet(offer: offer, brandId: brandId),
    ),
  );
}

class _BoostSheet extends ConsumerStatefulWidget {
  const _BoostSheet({required this.offer, required this.brandId});
  final Offer offer;
  final String brandId;

  @override
  ConsumerState<_BoostSheet> createState() => _BoostSheetState();
}

class _BoostSheetState extends ConsumerState<_BoostSheet> {
  Razorpay? _razorpay;
  int? _selectedDays;
  bool _paying = false;
  String? _error;
  // Captured at order-creation time so the success/failure callbacks can use it
  // without re-fetching.
  String? _pendingOrderId;

  @override
  void initState() {
    super.initState();
    if (!kIsWeb) {
      _razorpay = Razorpay()
        ..on(Razorpay.EVENT_PAYMENT_SUCCESS, _onSuccess)
        ..on(Razorpay.EVENT_PAYMENT_ERROR, _onError)
        ..on(Razorpay.EVENT_EXTERNAL_WALLET, _onExternalWallet);
    }
  }

  @override
  void dispose() {
    _razorpay?.clear();
    super.dispose();
  }

  Future<void> _pay() async {
    if (_selectedDays == null) return;
    setState(() {
      _paying = true;
      _error = null;
    });
    try {
      final cfg = await ref.read(paymentsRepositoryProvider).config();
      if (!cfg.enabled || cfg.keyId == null) {
        throw 'Online payments are not configured on the server yet.';
      }

      final order = await ref.read(paymentsRepositoryProvider).createBoostOrder(
            offerId: widget.offer.id,
            days: _selectedDays!,
          );
      _pendingOrderId = order.id;

      if (kIsWeb) {
        // razorpay_flutter doesn't run in the browser — bounce to the admin
        // panel which has the JS-based Checkout wired up.
        final uri = Uri.parse('${ApiConstants.panelUrl}/seller/offers');
        await launchUrl(uri, mode: LaunchMode.externalApplication);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
            content: Text('Finish the payment in the browser, then refresh the list.'),
          ));
          Navigator.of(context).pop(false);
        }
        return;
      }

      final user = ref.read(authControllerProvider).value;
      _razorpay!.open({
        'key': cfg.keyId,
        'order_id': order.id,
        'amount': order.amount, // already in paise from the API
        'currency': order.currency,
        'name': 'OffersKatta',
        'description': 'Boost: ${widget.offer.title} ($_selectedDays days featured)',
        'prefill': {
          if (user?.fullName != null) 'name': user!.fullName,
          if (user?.email != null) 'email': user!.email,
        },
        'theme': {'color': '#0f172a'},
      });
      // Don't pop here — the result handlers will pop after success/failure.
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = '$e';
          _paying = false;
        });
      }
    }
  }

  // Razorpay's native callback runs on the Android UI thread and expects a
  // fast return; doing HTTP/setState/Navigator work synchronously inside it
  // blocks long enough to trip ANR. Capture the data, then defer the actual
  // work to the next event-loop tick so the bridge can finish unblocking.

  void _onSuccess(PaymentSuccessResponse r) {
    final orderId = r.orderId ?? _pendingOrderId ?? '';
    final paymentId = r.paymentId ?? '';
    final signature = r.signature ?? '';
    Future.microtask(() async {
      try {
        await ref.read(paymentsRepositoryProvider).verify(
              razorpayOrderId: orderId,
              razorpayPaymentId: paymentId,
              razorpaySignature: signature,
            );
        ref.invalidate(offersForBrandProvider(widget.brandId));
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Offer boosted — it is now featured.'),
        ));
        Navigator.of(context).pop(true);
      } catch (e) {
        if (!mounted) return;
        setState(() {
          _error = 'Payment verification failed: $e';
          _paying = false;
        });
      }
    });
  }

  void _onError(PaymentFailureResponse r) {
    final msg = r.message ?? 'Payment failed';
    Future.microtask(() {
      if (!mounted) return;
      setState(() {
        _error = msg;
        _paying = false;
      });
    });
  }

  void _onExternalWallet(ExternalWalletResponse r) {
    final wallet = r.walletName ?? 'unknown';
    Future.microtask(() {
      if (!mounted) return;
      setState(() {
        _error = 'External wallet flow is not supported in-app yet ($wallet).';
        _paying = false;
      });
    });
  }

  @override
  Widget build(BuildContext context) {
    final options = ref.watch(boostOptionsProvider);
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 16),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(children: [
                const Icon(Icons.rocket_launch, color: Colors.orange),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Boost "${widget.offer.title}"',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close),
                  onPressed: _paying ? null : () => Navigator.of(context).pop(false),
                ),
              ]),
              const SizedBox(height: 8),
              Text(
                'Feature this offer at the top of the home + search lists for a '
                'set number of days.',
                style: Theme.of(context).textTheme.bodySmall,
              ),
              const SizedBox(height: 16),
              options.when(
                loading: () => const Padding(
                  padding: EdgeInsets.all(24),
                  child: Center(child: CircularProgressIndicator()),
                ),
                error: (e, _) => Padding(
                  padding: const EdgeInsets.all(16),
                  child: Text('Could not load boost options: $e',
                      style: TextStyle(color: Theme.of(context).colorScheme.error)),
                ),
                data: (tiers) => Column(
                  children: tiers.map((t) => _TierTile(
                        option: t,
                        selected: _selectedDays == t.days,
                        onTap: _paying
                            ? null
                            : () => setState(() => _selectedDays = t.days),
                      )).toList(growable: false),
                ),
              ),
              if (_error != null) ...[
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: Theme.of(context).colorScheme.errorContainer,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(_error!,
                      style: TextStyle(color: Theme.of(context).colorScheme.onErrorContainer)),
                ),
              ],
              const SizedBox(height: 16),
              FilledButton.icon(
                onPressed: (_selectedDays == null || _paying) ? null : _pay,
                icon: _paying
                    ? const SizedBox(
                        height: 16, width: 16, child: CircularProgressIndicator(strokeWidth: 2))
                    : const Icon(Icons.payment),
                label: Text(_paying
                    ? 'Opening payment…'
                    : _selectedDays == null
                        ? 'Pick a tier'
                        : 'Pay & boost for $_selectedDays days'),
              ),
              if (kIsWeb)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text(
                    'On the web build, the payment finishes in your browser on '
                    'the admin panel. Use the Android app for full in-app checkout.',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _TierTile extends StatelessWidget {
  const _TierTile({required this.option, required this.selected, required this.onTap});
  final BoostOption option;
  final bool selected;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final color = selected ? Theme.of(context).colorScheme.primary : Theme.of(context).dividerColor;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(10),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(
            border: Border.all(color: color, width: selected ? 2 : 1),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Row(
            children: [
              Icon(selected ? Icons.radio_button_checked : Icons.radio_button_unchecked,
                  color: color, size: 22),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('${option.days} days featured',
                        style: const TextStyle(fontWeight: FontWeight.w600)),
                    Text('₹${option.price.toStringAsFixed(0)} · ${option.currency}',
                        style: Theme.of(context).textTheme.bodySmall),
                  ],
                ),
              ),
              if (option.days == 30)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: Colors.orange.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Text('Best value',
                      style: TextStyle(fontSize: 11, color: Colors.orange, fontWeight: FontWeight.w600)),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
