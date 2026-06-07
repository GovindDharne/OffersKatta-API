import 'package:flutter/material.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../../domain/entities/redemption.dart';

class RedemptionQrDialog extends StatelessWidget {
  const RedemptionQrDialog({super.key, required this.redemption});
  final IssuedRedemption redemption;

  @override
  Widget build(BuildContext context) {
    final r = redemption.redemption;
    return AlertDialog(
      title: const Text('Show at the counter'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          QrImageView(
            data: r.qrCode,
            version: QrVersions.auto,
            size: 220,
            backgroundColor: Colors.white,
          ),
          const SizedBox(height: 12),
          SelectableText(
            r.qrCode,
            style: const TextStyle(fontFamily: 'monospace', letterSpacing: 1.5),
          ),
          const SizedBox(height: 8),
          Text(
            'Valid until ${r.expiresAt.toLocal()}',
            style: Theme.of(context).textTheme.bodySmall,
          ),
        ],
      ),
      actions: [
        TextButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Close')),
      ],
    );
  }
}
