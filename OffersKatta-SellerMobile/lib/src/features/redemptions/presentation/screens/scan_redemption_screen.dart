import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../../../auth/presentation/providers/auth_providers.dart';
import '../../data/models/redemption_models.dart';
import '../providers/redemptions_providers.dart';

class ScanRedemptionScreen extends ConsumerStatefulWidget {
  const ScanRedemptionScreen({super.key});

  @override
  ConsumerState<ScanRedemptionScreen> createState() => _ScanRedemptionScreenState();
}

class _ScanRedemptionScreenState extends ConsumerState<ScanRedemptionScreen> {
  late final MobileScannerController _ctrl;
  bool _torchOn = false;
  bool _handling = false; // gate so a single detection doesn't fire twice

  @override
  void initState() {
    super.initState();
    _ctrl = MobileScannerController(
      formats: const [BarcodeFormat.qrCode],
      detectionSpeed: DetectionSpeed.normal,
    );
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isStaff = _isStaff(ref);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Scan customer QR'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.go('/dashboard'),
        ),
        actions: [
          IconButton(
            tooltip: _torchOn ? 'Turn torch off' : 'Turn torch on',
            icon: Icon(_torchOn ? Icons.flash_on : Icons.flash_off),
            onPressed: () async {
              await _ctrl.toggleTorch();
              if (mounted) setState(() => _torchOn = !_torchOn);
            },
          ),
          IconButton(
            tooltip: 'Switch camera',
            icon: const Icon(Icons.cameraswitch_outlined),
            onPressed: () => _ctrl.switchCamera(),
          ),
        ],
      ),
      body: !isStaff
          ? _NotStaffPlaceholder()
          : Column(
              children: [
                Expanded(
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      MobileScanner(
                        controller: _ctrl,
                        onDetect: _onDetect,
                        errorBuilder: (_, err, __) => _ScannerError(error: err),
                      ),
                      const _ScanOverlay(),
                      Positioned(
                        left: 16,
                        right: 16,
                        bottom: 16,
                        child: SafeArea(
                          top: false,
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                            decoration: BoxDecoration(
                              color: Colors.black.withValues(alpha: 0.55),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: const Text(
                              'Point the camera at the customer\'s QR code.',
                              textAlign: TextAlign.center,
                              style: TextStyle(color: Colors.white, fontSize: 12),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                _BottomActions(
                  onManual: () => _openManualEntry(),
                  onRecent: () => _openRecent(),
                ),
              ],
            ),
    );
  }

  void _onDetect(BarcodeCapture cap) {
    if (_handling) return;
    final code = cap.barcodes
        .map((b) => b.rawValue)
        .whereType<String>()
        .firstWhere((s) => s.isNotEmpty, orElse: () => '');
    if (code.isEmpty) return;
    _openConfirmSheet(code);
  }

  Future<void> _openConfirmSheet(String code) async {
    setState(() => _handling = true);
    HapticFeedback.lightImpact();
    await _ctrl.stop();
    if (!mounted) return;
    await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _ConfirmRedemptionSheet(qrCode: code),
    );
    if (!mounted) return;
    // No need to refresh anything here — the /redemptions screen invalidates
    // its own list on first build / pull-to-refresh, and the confirm sheet
    // updates the offer's totalRedemptions counter server-side.
    await _ctrl.start();
    setState(() => _handling = false);
  }

  Future<void> _openManualEntry() async {
    final ctrl = TextEditingController();
    await _ctrl.stop();
    if (!mounted) return;
    final entered = await showDialog<String?>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Enter QR code'),
        content: TextField(
          controller: ctrl,
          textCapitalization: TextCapitalization.characters,
          autofocus: true,
          decoration: const InputDecoration(hintText: 'e.g. ZTKYW9PVQQCA5CGB'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(null),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(ctrl.text.trim()),
            child: const Text('Continue'),
          ),
        ],
      ),
    );
    if (!mounted) return;
    if (entered != null && entered.isNotEmpty) {
      await _openConfirmSheet(entered);
    } else {
      await _ctrl.start();
    }
  }

  Future<void> _openRecent() async {
    await _ctrl.stop();
    if (!mounted) return;
    // The dedicated /redemptions screen has the brand+branch pickers and the
    // full history list with summary counters. We just jump to it.
    context.go('/redemptions');
  }

  bool _isStaff(WidgetRef ref) {
    // Match the seller role gate (SELLER_OWNER, BUSINESS_MANAGER, STAFF, SUPER_ADMIN).
    final user = ref.watch(authControllerProvider).value;
    return user != null;
  }
}

// ──────────────────────────────────────────────────────────────────────
// Confirm sheet
// ──────────────────────────────────────────────────────────────────────

class _ConfirmRedemptionSheet extends ConsumerStatefulWidget {
  const _ConfirmRedemptionSheet({required this.qrCode});
  final String qrCode;

  @override
  ConsumerState<_ConfirmRedemptionSheet> createState() => _ConfirmRedemptionSheetState();
}

class _ConfirmRedemptionSheetState extends ConsumerState<_ConfirmRedemptionSheet> {
  final _amount = TextEditingController();
  final _notes = TextEditingController();
  bool _busy = false;
  String? _error;
  RedemptionInfo? _confirmed;

  @override
  void dispose() {
    _amount.dispose();
    _notes.dispose();
    super.dispose();
  }

  Future<void> _confirm() async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final amt = num.tryParse(_amount.text.trim());
      final notes = _notes.text.trim();
      final result = await ref.read(redemptionsRepositoryProvider).confirm(
            qrCode: widget.qrCode,
            finalAmount: amt,
            notes: notes.isEmpty ? null : notes,
          );
      if (!mounted) return;
      setState(() {
        _busy = false;
        _confirmed = result;
      });
      HapticFeedback.mediumImpact();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = '$e';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final inset = MediaQuery.of(context).viewInsets.bottom;
    final body = _confirmed != null
        ? _SuccessBlock(redemption: _confirmed!, onDone: () => Navigator.of(context).pop(true))
        : _PendingForm(
            qrCode: widget.qrCode,
            amount: _amount,
            notes: _notes,
            error: _error,
            busy: _busy,
            onCancel: () => Navigator.of(context).pop(false),
            onConfirm: _confirm,
            scheme: scheme,
          );
    return Padding(
      padding: EdgeInsets.only(left: 16, right: 16, top: 16, bottom: 16 + inset),
      child: SingleChildScrollView(child: body),
    );
  }
}

class _PendingForm extends StatelessWidget {
  const _PendingForm({
    required this.qrCode,
    required this.amount,
    required this.notes,
    required this.error,
    required this.busy,
    required this.onCancel,
    required this.onConfirm,
    required this.scheme,
  });

  final String qrCode;
  final TextEditingController amount;
  final TextEditingController notes;
  final String? error;
  final bool busy;
  final VoidCallback onCancel;
  final VoidCallback onConfirm;
  final ColorScheme scheme;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(Icons.qr_code_2, color: scheme.primary),
            const SizedBox(width: 8),
            const Expanded(
              child: Text('Confirm redemption',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
            ),
            IconButton(icon: const Icon(Icons.close), onPressed: busy ? null : onCancel),
          ],
        ),
        const SizedBox(height: 4),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          decoration: BoxDecoration(
            color: scheme.surfaceContainerHighest,
            borderRadius: BorderRadius.circular(6),
          ),
          child: Text(
            qrCode,
            style: const TextStyle(
                fontFamily: 'monospace', fontWeight: FontWeight.w600, letterSpacing: 1.5),
          ),
        ),
        const SizedBox(height: 16),
        TextField(
          controller: amount,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          decoration: const InputDecoration(
            labelText: 'Final bill amount (optional)',
            prefixText: '₹ ',
            border: OutlineInputBorder(),
            helperText: 'Used to compute the actual discount given.',
          ),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: notes,
          maxLines: 2,
          decoration: const InputDecoration(
            labelText: 'Notes (optional)',
            border: OutlineInputBorder(),
          ),
        ),
        if (error != null) ...[
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: scheme.errorContainer,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Row(
              children: [
                Icon(Icons.error_outline, color: scheme.onErrorContainer, size: 18),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(error!, style: TextStyle(color: scheme.onErrorContainer)),
                ),
              ],
            ),
          ),
        ],
        const SizedBox(height: 16),
        Row(
          mainAxisAlignment: MainAxisAlignment.end,
          children: [
            TextButton(onPressed: busy ? null : onCancel, child: const Text('Cancel')),
            const SizedBox(width: 8),
            FilledButton.icon(
              onPressed: busy ? null : onConfirm,
              icon: busy
                  ? const SizedBox(
                      height: 16,
                      width: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.check),
              label: const Text('Confirm redemption'),
            ),
          ],
        ),
      ],
    );
  }
}

class _SuccessBlock extends StatelessWidget {
  const _SuccessBlock({required this.redemption, required this.onDone});
  final RedemptionInfo redemption;
  final VoidCallback onDone;

  @override
  Widget build(BuildContext context) {
    final r = redemption;
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 56,
          height: 56,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: Colors.green.shade100,
            shape: BoxShape.circle,
          ),
          child: const Icon(Icons.check, color: Colors.green, size: 32),
        ),
        const SizedBox(height: 12),
        const Text('Redemption confirmed',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
        const SizedBox(height: 12),
        if (r.offerTitle != null)
          Padding(
            padding: const EdgeInsets.only(bottom: 4),
            child: Text(r.offerTitle!,
                style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
          ),
        if (r.customerName != null)
          _kv('Customer', r.customerName!),
        if (r.customerPhone != null) _kv('Phone', r.customerPhone!),
        if (r.finalAmount != null) _kv('Final amount', '₹${r.finalAmount}'),
        if (r.discountApplied != null) _kv('Discount given', '₹${r.discountApplied}'),
        _kv('QR', r.qrCode),
        if (r.redeemedAt != null)
          _kv('Redeemed at', DateFormat('d MMM yyyy, HH:mm').format(r.redeemedAt!.toLocal())),
        if (r.notes != null && r.notes!.isNotEmpty) _kv('Notes', r.notes!),
        const SizedBox(height: 16),
        Row(
          mainAxisAlignment: MainAxisAlignment.end,
          children: [
            FilledButton(onPressed: onDone, child: const Text('Done')),
          ],
        ),
      ],
    );
  }

  Widget _kv(String k, String v) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 2),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
              width: 110,
              child: Text(k, style: const TextStyle(color: Colors.grey, fontSize: 12)),
            ),
            Expanded(child: Text(v, style: const TextStyle(fontSize: 13))),
          ],
        ),
      );
}

// ──────────────────────────────────────────────────────────────────────
// Bottom actions + visual overlay
// ──────────────────────────────────────────────────────────────────────

class _BottomActions extends StatelessWidget {
  const _BottomActions({required this.onManual, required this.onRecent});
  final VoidCallback onManual;
  final VoidCallback onRecent;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            Expanded(
              child: OutlinedButton.icon(
                icon: const Icon(Icons.keyboard_outlined),
                label: const Text('Enter code'),
                onPressed: onManual,
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: OutlinedButton.icon(
                icon: const Icon(Icons.history),
                label: const Text('Recent'),
                onPressed: onRecent,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ScanOverlay extends StatelessWidget {
  const _ScanOverlay();

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: Center(
        child: SizedBox(
          width: 240,
          height: 240,
          child: CustomPaint(painter: _CornerBracketPainter(color: Colors.white)),
        ),
      ),
    );
  }
}

class _CornerBracketPainter extends CustomPainter {
  _CornerBracketPainter({required this.color});
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final p = Paint()
      ..color = color
      ..strokeWidth = 3
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;
    const arm = 26.0;
    // TL
    canvas.drawLine(const Offset(0, 0), const Offset(arm, 0), p);
    canvas.drawLine(const Offset(0, 0), const Offset(0, arm), p);
    // TR
    canvas.drawLine(Offset(size.width, 0), Offset(size.width - arm, 0), p);
    canvas.drawLine(Offset(size.width, 0), Offset(size.width, arm), p);
    // BL
    canvas.drawLine(Offset(0, size.height), Offset(arm, size.height), p);
    canvas.drawLine(Offset(0, size.height), Offset(0, size.height - arm), p);
    // BR
    canvas.drawLine(Offset(size.width, size.height), Offset(size.width - arm, size.height), p);
    canvas.drawLine(Offset(size.width, size.height), Offset(size.width, size.height - arm), p);
  }

  @override
  bool shouldRepaint(covariant _CornerBracketPainter old) => old.color != color;
}

class _ScannerError extends StatelessWidget {
  const _ScannerError({required this.error});
  final MobileScannerException error;

  @override
  Widget build(BuildContext context) {
    final msg = switch (error.errorCode) {
      MobileScannerErrorCode.permissionDenied =>
        'Camera permission denied. Enable it in app settings to scan QRs.',
      MobileScannerErrorCode.unsupported =>
        'This device does not support QR scanning.',
      _ => 'Camera error: ${error.errorDetails?.message ?? error.errorCode}',
    };
    return Container(
      color: Colors.black,
      alignment: Alignment.center,
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.error_outline, color: Colors.white, size: 48),
          const SizedBox(height: 12),
          Text(msg, style: const TextStyle(color: Colors.white), textAlign: TextAlign.center),
        ],
      ),
    );
  }
}

class _NotStaffPlaceholder extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.all(32),
      child: Center(
        child: Text(
          'Sign in as a seller / staff to scan customer redemptions.',
          textAlign: TextAlign.center,
        ),
      ),
    );
  }
}
