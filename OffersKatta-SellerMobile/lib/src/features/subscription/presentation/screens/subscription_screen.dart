import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:razorpay_flutter/razorpay_flutter.dart';

import '../../../auth/presentation/providers/auth_providers.dart';
import '../../../brands/domain/entities/brand.dart';
import '../../../brands/presentation/providers/brands_providers.dart';
import '../../data/models/subscription_models.dart';
import '../providers/subscription_providers.dart';

class SubscriptionScreen extends ConsumerStatefulWidget {
  const SubscriptionScreen({super.key});

  @override
  ConsumerState<SubscriptionScreen> createState() => _SubscriptionScreenState();
}

class _SubscriptionScreenState extends ConsumerState<SubscriptionScreen> {
  String? _brandId;
  BillingInterval _interval = BillingInterval.monthly;
  PlanName? _processing;

  // Razorpay holds native handles — must be a long-lived instance and explicitly
  // cleared on dispose, otherwise the platform channel leaks.
  late final Razorpay _razorpay;

  // We need to remember which order/brand the user just paid for so the
  // success handler can verify the signature and refresh the right providers.
  String? _pendingOrderId;
  String? _pendingBrandId;

  @override
  void initState() {
    super.initState();
    _razorpay = Razorpay();
    _razorpay.on(Razorpay.EVENT_PAYMENT_SUCCESS, _onPaymentSuccess);
    _razorpay.on(Razorpay.EVENT_PAYMENT_ERROR, _onPaymentError);
    _razorpay.on(Razorpay.EVENT_EXTERNAL_WALLET, _onExternalWallet);
  }

  @override
  void dispose() {
    _razorpay.clear();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final brands = ref.watch(myBrandsProvider);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Subscription'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.go('/dashboard'),
        ),
      ),
      body: brands.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.error_outline, size: 48, color: Colors.red),
                const SizedBox(height: 8),
                Text('$e', textAlign: TextAlign.center),
                const SizedBox(height: 16),
                TextButton(
                  onPressed: () => ref.invalidate(myBrandsProvider),
                  child: const Text('Retry'),
                ),
              ],
            ),
          ),
        ),
        data: (bs) {
          if (bs.isEmpty) {
            return const Center(
              child: Padding(
                padding: EdgeInsets.all(24),
                child: Text(
                  'You don\'t have any brands yet. Create a brand first to choose a subscription.',
                  textAlign: TextAlign.center,
                ),
              ),
            );
          }
          // Default to the first brand on first build.
          _brandId ??= bs.first.id;
          return _buildBody(bs);
        },
      ),
    );
  }

  Widget _buildBody(List<Brand> brands) {
    final plansAsync = ref.watch(plansProvider);
    final cfgAsync = ref.watch(paymentsConfigProvider);
    final subAsync = ref.watch(brandSubscriptionProvider(_brandId!));
    final paymentsAsync = ref.watch(brandPaymentsProvider(_brandId!));

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _BrandIntervalPicker(
          brands: brands,
          brandId: _brandId!,
          interval: _interval,
          onBrandChanged: (id) => setState(() => _brandId = id),
          onIntervalChanged: (i) => setState(() => _interval = i),
        ),
        const SizedBox(height: 12),
        cfgAsync.when(
          loading: () => const SizedBox.shrink(),
          error: (_, __) => const SizedBox.shrink(),
          data: (cfg) => cfg.enabled
              ? const SizedBox.shrink()
              : const _AmberBanner(
                  text:
                      'Online payments aren\'t configured on this server yet — paid plans can be selected but not activated until Razorpay keys are added.',
                ),
        ),
        const SizedBox(height: 12),
        _CurrentPlanCard(subAsync: subAsync),
        const SizedBox(height: 12),
        subAsync.maybeWhen(
          data: (sub) => sub != null && sub.isActiveAndUnexpired
              ? _AmberBanner(
                  text:
                      'This brand has an active subscription until ${_fmtDate(sub.endDate!)}. You can renew or change the plan once it expires.',
                )
              : const SizedBox.shrink(),
          orElse: () => const SizedBox.shrink(),
        ),
        const SizedBox(height: 12),
        plansAsync.when(
          loading: () => const Padding(
            padding: EdgeInsets.symmetric(vertical: 24),
            child: Center(child: CircularProgressIndicator()),
          ),
          error: (e, _) => _ErrorRow(error: '$e', onRetry: () => ref.invalidate(plansProvider)),
          data: (plans) => Column(
            children: [
              for (final p in plans) ...[
                _PlanCard(
                  plan: p,
                  interval: _interval,
                  currentSub: subAsync.asData?.value,
                  processing: _processing,
                  onChoose: () => _onChoose(p),
                  onContactSales: () => _openSalesSheet(brands),
                ),
                const SizedBox(height: 12),
              ],
            ],
          ),
        ),
        const SizedBox(height: 8),
        _PaymentHistoryCard(paymentsAsync: paymentsAsync),
        const SizedBox(height: 24),
      ],
    );
  }

  // ─────────────────────── plan-choice flow ───────────────────────

  Future<void> _onChoose(Plan p) async {
    if (_brandId == null || _processing != null) return;
    if (p.contactSales) {
      _openSalesSheet(ref.read(myBrandsProvider).value ?? const []);
      return;
    }

    setState(() => _processing = p.plan);
    final repo = ref.read(subscriptionRepositoryProvider);
    final messenger = ScaffoldMessenger.of(context);
    try {
      final res = await repo.changePlan(
        brandId: _brandId!,
        plan: p.plan,
        billingInterval: _interval,
      );
      ref.invalidate(brandSubscriptionProvider(_brandId!));

      if (res.amount <= 0) {
        messenger.showSnackBar(const SnackBar(content: Text('Plan updated')));
        setState(() => _processing = null);
        return;
      }

      // Paid plan → Razorpay
      final cfg = await repo.paymentsConfig();
      if (!cfg.enabled || cfg.keyId == null) {
        messenger.showSnackBar(const SnackBar(
          content: Text('Online payments are not configured yet. Please contact the administrator.'),
        ));
        setState(() => _processing = null);
        return;
      }

      final order = await repo.createOrder(
        brandId: _brandId!,
        amount: res.amount,
        description: '${planNameLabel(p.plan)} subscription (${_interval.name})',
      );

      _pendingOrderId = order.order.id;
      _pendingBrandId = _brandId;

      final user = ref.read(authControllerProvider).value;
      final options = <String, dynamic>{
        'key': cfg.keyId,
        'order_id': order.order.id,
        'amount': order.order.amount,
        'currency': order.order.currency,
        'name': 'OffersKatta',
        'description': '${planNameLabel(p.plan)} subscription — ${_interval.name}',
        'prefill': {
          if (user?.email != null) 'email': user!.email,
          if (user?.fullName != null) 'name': user!.fullName,
          if (user?.phone != null) 'contact': user!.phone,
        },
        'theme': {'color': '#0F172A'},
      };
      _razorpay.open(options);
      // _processing stays set until the Razorpay handler resolves; it gets
      // cleared in _onPaymentSuccess / _onPaymentError.
    } catch (e) {
      messenger.showSnackBar(SnackBar(content: Text('$e')));
      setState(() => _processing = null);
    }
  }

  Future<void> _onPaymentSuccess(PaymentSuccessResponse resp) async {
    final messenger = ScaffoldMessenger.of(context);
    final repo = ref.read(subscriptionRepositoryProvider);
    try {
      await repo.verifyPayment(
        razorpayOrderId: resp.orderId ?? _pendingOrderId ?? '',
        razorpayPaymentId: resp.paymentId ?? '',
        razorpaySignature: resp.signature ?? '',
      );
      messenger.showSnackBar(const SnackBar(
        content: Text('Payment successful — your plan is now active'),
      ));
      if (_pendingBrandId != null) {
        ref.invalidate(brandSubscriptionProvider(_pendingBrandId!));
        ref.invalidate(brandPaymentsProvider(_pendingBrandId!));
      }
    } catch (e) {
      messenger.showSnackBar(SnackBar(
        content: Text('Payment received but verification failed: $e'),
      ));
    } finally {
      _clearPending();
    }
  }

  void _onPaymentError(PaymentFailureResponse resp) {
    final messenger = ScaffoldMessenger.of(context);
    // Razorpay returns Code 2 for user-cancellation; treat that softly.
    final msg = resp.code == Razorpay.PAYMENT_CANCELLED
        ? 'Payment cancelled — your plan was not activated'
        : 'Payment failed${resp.message != null ? ': ${resp.message}' : ''}';
    messenger.showSnackBar(SnackBar(content: Text(msg)));
    _clearPending();
  }

  void _onExternalWallet(ExternalWalletResponse resp) {
    // No-op; we still wait for SUCCESS/ERROR for the real outcome.
  }

  void _clearPending() {
    _pendingOrderId = null;
    _pendingBrandId = null;
    if (mounted) setState(() => _processing = null);
  }

  // ─────────────────────── enterprise lead sheet ───────────────────────

  void _openSalesSheet(List<Brand> brands) {
    final user = ref.read(authControllerProvider).value;
    final brand = brands.firstWhere(
      (b) => b.id == _brandId,
      orElse: () => brands.isNotEmpty
          ? brands.first
          : Brand(id: '', name: '', slug: ''),
    );
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => _ContactSalesSheet(
        initialCompany: brand.name,
        initialContact: user?.fullName ?? '',
        initialEmail: user?.email ?? '',
        brandId: _brandId,
        onSubmit: (lead) async {
          final messenger = ScaffoldMessenger.of(ctx);
          final nav = Navigator.of(ctx);
          try {
            await ref.read(subscriptionRepositoryProvider).submitEnterpriseLead(lead);
            nav.pop();
            messenger.showSnackBar(const SnackBar(
              content: Text('Thanks! Our sales team will reach out shortly.'),
            ));
          } catch (e) {
            messenger.showSnackBar(SnackBar(content: Text('$e')));
          }
        },
      ),
    );
  }
}

// ──────────────────────────────────────────────────────────────────────
// Sub-widgets
// ──────────────────────────────────────────────────────────────────────

class _BrandIntervalPicker extends StatelessWidget {
  const _BrandIntervalPicker({
    required this.brands,
    required this.brandId,
    required this.interval,
    required this.onBrandChanged,
    required this.onIntervalChanged,
  });

  final List<Brand> brands;
  final String brandId;
  final BillingInterval interval;
  final ValueChanged<String> onBrandChanged;
  final ValueChanged<BillingInterval> onIntervalChanged;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Brand', style: TextStyle(fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            DropdownButtonFormField<String>(
              value: brandId,
              decoration: const InputDecoration(border: OutlineInputBorder()),
              items: brands
                  .map((b) => DropdownMenuItem(value: b.id, child: Text(b.name)))
                  .toList(growable: false),
              onChanged: (v) {
                if (v != null) onBrandChanged(v);
              },
            ),
            const SizedBox(height: 16),
            const Text('Billing', style: TextStyle(fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            SegmentedButton<BillingInterval>(
              segments: const [
                ButtonSegment(value: BillingInterval.monthly, label: Text('Monthly')),
                ButtonSegment(value: BillingInterval.yearly, label: Text('Yearly (save 17%)')),
              ],
              selected: {interval},
              onSelectionChanged: (s) => onIntervalChanged(s.first),
            ),
          ],
        ),
      ),
    );
  }
}

class _CurrentPlanCard extends StatelessWidget {
  const _CurrentPlanCard({required this.subAsync});
  final AsyncValue<SubscriptionInfo?> subAsync;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Current plan', style: TextStyle(fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            subAsync.when(
              loading: () => const SizedBox(
                height: 32,
                child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
              ),
              error: (e, _) => Text('$e'),
              data: (sub) {
                if (sub == null) {
                  return const Text('No subscription yet.', style: TextStyle(color: Colors.grey));
                }
                final renews = sub.endDate != null ? ' · renews ${_fmtDate(sub.endDate!)}' : '';
                return Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(planNameLabel(sub.plan),
                              style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w600)),
                          const SizedBox(height: 4),
                          Text(
                            '${sub.status.toLowerCase()} · ${_fmtMoney(sub.amount, sub.currency)} / ${sub.billingInterval.name}$renews',
                            style: const TextStyle(fontSize: 12, color: Colors.grey),
                          ),
                        ],
                      ),
                    ),
                    _StatusChip(status: sub.status),
                  ],
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _PlanCard extends StatelessWidget {
  const _PlanCard({
    required this.plan,
    required this.interval,
    required this.currentSub,
    required this.processing,
    required this.onChoose,
    required this.onContactSales,
  });

  final Plan plan;
  final BillingInterval interval;
  final SubscriptionInfo? currentSub;
  final PlanName? processing;
  final VoidCallback onChoose;
  final VoidCallback onContactSales;

  @override
  Widget build(BuildContext context) {
    final isCurrent =
        currentSub?.plan == plan.plan && currentSub?.status.toUpperCase() == 'ACTIVE';
    final lockedByActive = currentSub?.isActiveAndUnexpired ?? false;
    final isProcessingThis = processing == plan.plan;
    final emphasis = plan.plan == PlanName.premium;

    if (plan.contactSales) {
      return Card(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: BorderSide(color: Colors.grey.shade400, style: BorderStyle.solid),
        ),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Icon(Icons.business_outlined, size: 18),
                  const SizedBox(width: 6),
                  Text(planNameLabel(plan.plan),
                      style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
                ],
              ),
              const SizedBox(height: 4),
              const Text('Custom pricing', style: TextStyle(color: Colors.grey)),
              const SizedBox(height: 12),
              const _Feature('Everything in Featured'),
              const _Feature('Region/zone management at scale'),
              const _Feature('Top push priority & bulk onboarding'),
              const _Feature('Dedicated account manager'),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton(
                  onPressed: isCurrent ? null : onContactSales,
                  child: Text(isCurrent ? 'Current plan' : 'Contact Sales'),
                ),
              ),
            ],
          ),
        ),
      );
    }

    final price = interval == BillingInterval.monthly ? plan.monthly : plan.yearly;
    final priceLabel = '${_fmtMoney(price ?? 0, plan.currency)} / ${interval.name}';

    String buttonLabel() {
      if (isProcessingThis) return 'Processing…';
      if (isCurrent) return 'Current plan';
      if (lockedByActive) return 'Subscription active';
      if ((price ?? 0) > 0) return 'Subscribe';
      return 'Choose';
    }

    return Card(
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: emphasis
            ? BorderSide(color: Theme.of(context).colorScheme.primary, width: 1.5)
            : BorderSide(color: Colors.grey.shade300),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(planNameLabel(plan.plan),
                style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
            const SizedBox(height: 4),
            Text(priceLabel, style: const TextStyle(color: Colors.grey)),
            const SizedBox(height: 12),
            _Feature(plan.plan == PlanName.free
                ? '1 branch'
                : plan.plan == PlanName.premium
                    ? 'Unlimited branches'
                    : 'Featured placement'),
            _Feature(plan.plan == PlanName.free ? '3 offers/month' : 'Unlimited offers'),
            _Feature(plan.plan == PlanName.featured ? 'Top of search' : 'Standard ranking'),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: emphasis
                  ? FilledButton(
                      onPressed: (isCurrent || lockedByActive || processing != null)
                          ? null
                          : onChoose,
                      child: _ButtonChild(label: buttonLabel(), busy: isProcessingThis),
                    )
                  : OutlinedButton(
                      onPressed: (isCurrent || lockedByActive || processing != null)
                          ? null
                          : onChoose,
                      child: _ButtonChild(label: buttonLabel(), busy: isProcessingThis),
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ButtonChild extends StatelessWidget {
  const _ButtonChild({required this.label, required this.busy});
  final String label;
  final bool busy;

  @override
  Widget build(BuildContext context) {
    if (!busy) return Text(label);
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        const SizedBox(
          width: 14,
          height: 14,
          child: CircularProgressIndicator(strokeWidth: 2),
        ),
        const SizedBox(width: 8),
        Text(label),
      ],
    );
  }
}

class _Feature extends StatelessWidget {
  const _Feature(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        children: [
          Icon(Icons.check, size: 16, color: Theme.of(context).colorScheme.primary),
          const SizedBox(width: 6),
          Expanded(child: Text(text, style: const TextStyle(color: Colors.grey))),
        ],
      ),
    );
  }
}

class _StatusChip extends StatelessWidget {
  const _StatusChip({required this.status});
  final String status;

  @override
  Widget build(BuildContext context) {
    final active = status.toUpperCase() == 'ACTIVE';
    return Chip(
      label: Text(status, style: const TextStyle(fontSize: 11)),
      backgroundColor: active ? Colors.green.shade100 : Colors.grey.shade200,
      labelStyle: TextStyle(color: active ? Colors.green.shade900 : Colors.black87),
    );
  }
}

class _AmberBanner extends StatelessWidget {
  const _AmberBanner({required this.text});
  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.amber.shade50,
        border: Border.all(color: Colors.amber.shade300),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(text, style: TextStyle(color: Colors.amber.shade900, fontSize: 13)),
    );
  }
}

class _PaymentHistoryCard extends StatelessWidget {
  const _PaymentHistoryCard({required this.paymentsAsync});
  final AsyncValue<List<PaymentRecord>> paymentsAsync;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Payment history', style: TextStyle(fontWeight: FontWeight.w600)),
            const SizedBox(height: 4),
            const Text('Razorpay transactions for this brand.',
                style: TextStyle(color: Colors.grey, fontSize: 12)),
            const SizedBox(height: 12),
            paymentsAsync.when(
              loading: () => const SizedBox(
                height: 32,
                child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
              ),
              error: (e, _) => Text('$e'),
              data: (list) {
                if (list.isEmpty) {
                  return const Text('No payments yet.', style: TextStyle(color: Colors.grey));
                }
                return Column(
                  children: [
                    for (final p in list)
                      ListTile(
                        contentPadding: EdgeInsets.zero,
                        dense: true,
                        title: Text(_fmtMoney(p.amount, p.currency)),
                        subtitle: Text(
                          '${p.description ?? 'Payment'} · ${_fmtDate(p.paidAt ?? p.createdAt)}',
                          style: const TextStyle(fontSize: 12),
                        ),
                        trailing: _PaymentStatusChip(status: p.status),
                      ),
                  ],
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _PaymentStatusChip extends StatelessWidget {
  const _PaymentStatusChip({required this.status});
  final String status;

  @override
  Widget build(BuildContext context) {
    Color bg;
    Color fg;
    switch (status.toUpperCase()) {
      case 'SUCCESS':
        bg = Colors.green.shade100;
        fg = Colors.green.shade900;
        break;
      case 'FAILED':
        bg = Colors.red.shade100;
        fg = Colors.red.shade900;
        break;
      default:
        bg = Colors.grey.shade200;
        fg = Colors.black87;
    }
    return Chip(
      label: Text(status.toLowerCase(), style: const TextStyle(fontSize: 11)),
      backgroundColor: bg,
      labelStyle: TextStyle(color: fg),
    );
  }
}

class _ErrorRow extends StatelessWidget {
  const _ErrorRow({required this.error, required this.onRetry});
  final String error;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            Text(error, textAlign: TextAlign.center),
            const SizedBox(height: 8),
            TextButton(onPressed: onRetry, child: const Text('Retry')),
          ],
        ),
      ),
    );
  }
}

// ──────────────────────────────────────────────────────────────────────
// Contact-Sales bottom sheet
// ──────────────────────────────────────────────────────────────────────

class _ContactSalesSheet extends StatefulWidget {
  const _ContactSalesSheet({
    required this.initialCompany,
    required this.initialContact,
    required this.initialEmail,
    required this.brandId,
    required this.onSubmit,
  });

  final String initialCompany;
  final String initialContact;
  final String initialEmail;
  final String? brandId;
  final Future<void> Function(EnterpriseLead) onSubmit;

  @override
  State<_ContactSalesSheet> createState() => _ContactSalesSheetState();
}

class _ContactSalesSheetState extends State<_ContactSalesSheet> {
  late final TextEditingController _company;
  late final TextEditingController _contact;
  late final TextEditingController _email;
  final _phone = TextEditingController();
  final _branches = TextEditingController();
  final _message = TextEditingController();
  bool _busy = false;
  final _formKey = GlobalKey<FormState>();

  @override
  void initState() {
    super.initState();
    _company = TextEditingController(text: widget.initialCompany);
    _contact = TextEditingController(text: widget.initialContact);
    _email = TextEditingController(text: widget.initialEmail);
  }

  @override
  void dispose() {
    _company.dispose();
    _contact.dispose();
    _email.dispose();
    _phone.dispose();
    _branches.dispose();
    _message.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_busy) return;
    if (!_formKey.currentState!.validate()) return;
    setState(() => _busy = true);
    try {
      await widget.onSubmit(EnterpriseLead(
        companyName: _company.text.trim(),
        contactName: _contact.text.trim(),
        email: _email.text.trim(),
        phone: _phone.text.trim().isEmpty ? null : _phone.text.trim(),
        estimatedBranches:
            _branches.text.trim().isEmpty ? null : int.tryParse(_branches.text.trim()),
        message: _message.text.trim().isEmpty ? null : _message.text.trim(),
        brandId: widget.brandId,
      ));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final inset = MediaQuery.of(context).viewInsets.bottom;
    return Padding(
      padding: EdgeInsets.only(left: 16, right: 16, top: 16, bottom: 16 + inset),
      child: Form(
        key: _formKey,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Talk to sales about Enterprise',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
              const SizedBox(height: 4),
              const Text(
                'Tell us a bit about your business and we\'ll get in touch to set up a custom Enterprise plan. No payment is taken here.',
                style: TextStyle(color: Colors.grey, fontSize: 13),
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _company,
                decoration: const InputDecoration(labelText: 'Company', border: OutlineInputBorder()),
                validator: (v) =>
                    (v ?? '').trim().length < 2 ? 'At least 2 characters' : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _contact,
                decoration: const InputDecoration(labelText: 'Contact name', border: OutlineInputBorder()),
                validator: (v) =>
                    (v ?? '').trim().length < 2 ? 'At least 2 characters' : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _email,
                keyboardType: TextInputType.emailAddress,
                decoration: const InputDecoration(labelText: 'Email', border: OutlineInputBorder()),
                validator: (v) =>
                    (v == null || !v.contains('@')) ? 'Enter a valid email' : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _phone,
                keyboardType: TextInputType.phone,
                decoration: const InputDecoration(
                    labelText: 'Phone (optional)', border: OutlineInputBorder()),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _branches,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(
                  labelText: 'Approx. number of stores/branches (optional)',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _message,
                maxLines: 3,
                decoration: const InputDecoration(
                    labelText: 'Anything else? (optional)', border: OutlineInputBorder()),
              ),
              const SizedBox(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  TextButton(
                    onPressed: _busy ? null : () => Navigator.of(context).pop(),
                    child: const Text('Cancel'),
                  ),
                  const SizedBox(width: 8),
                  FilledButton(
                    onPressed: _busy ? null : _submit,
                    child: _busy
                        ? const SizedBox(
                            width: 14,
                            height: 14,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Text('Send enquiry'),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ──────────────────────────────────────────────────────────────────────
// Formatters
// ──────────────────────────────────────────────────────────────────────

String _fmtMoney(num amount, String currency) {
  final f = NumberFormat.currency(
    locale: 'en_IN',
    symbol: currency == 'INR' ? '₹' : '$currency ',
    decimalDigits: 0,
  );
  return f.format(amount);
}

String _fmtDate(DateTime d) => DateFormat('d MMM yyyy').format(d.toLocal());
