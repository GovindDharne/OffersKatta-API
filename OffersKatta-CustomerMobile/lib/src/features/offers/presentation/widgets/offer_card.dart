import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/utils/formatters.dart';
import '../../domain/entities/offer.dart';

class OfferCard extends StatelessWidget {
  const OfferCard({super.key, required this.offer});
  final Offer offer;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final headline = offerHeadline(offer.offerType, offer.discountValue);

    return Card(
      child: InkWell(
        onTap: () => context.push('/offers/${offer.id}'),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            AspectRatio(
              aspectRatio: 16 / 9,
              child: Stack(
                children: [
                  if (_thumbnail(offer) != null)
                    Image.network(
                      resolveAssetUrl(_thumbnail(offer))!,
                      fit: BoxFit.cover,
                      errorBuilder: (_, __, ___) => _placeholder(headline, scheme),
                    )
                  else
                    _placeholder(headline, scheme),
                  if (offer.isFeatured)
                    Positioned(
                      top: 8,
                      left: 8,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: scheme.primary,
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: Text(
                          'Featured',
                          style: TextStyle(color: scheme.onPrimary, fontSize: 11, fontWeight: FontWeight.w600),
                        ),
                      ),
                    ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    offer.title,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600),
                  ),
                  if (offer.branch?.brandName != null)
                    Text(
                      offer.branch!.brandName!,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(color: scheme.onSurfaceVariant),
                    ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Icon(Icons.local_offer_outlined, size: 14, color: scheme.onSurfaceVariant),
                      const SizedBox(width: 4),
                      Text(headline, style: Theme.of(context).textTheme.bodySmall),
                      const Spacer(),
                      Icon(Icons.place_outlined, size: 14, color: scheme.onSurfaceVariant),
                      const SizedBox(width: 4),
                      Flexible(
                        child: Text(
                          offer.distanceKm != null
                              ? '${offer.branch?.city ?? ''} · ${offer.distanceKm!.toStringAsFixed(1)}km'
                              : (offer.branch?.city ?? ''),
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// Match the website: prefer the seller-supplied `listImage` (it's specifically
  /// authored as a card thumbnail), fall back to the first gallery image, then
  /// nothing (caller renders the orange discount placeholder).
  static String? _thumbnail(Offer o) {
    if (o.listImage != null && o.listImage!.isNotEmpty) return o.listImage;
    if (o.images.isNotEmpty) return o.images.first;
    return null;
  }

  Widget _placeholder(String headline, ColorScheme scheme) {
    return Container(
      color: scheme.primaryContainer,
      alignment: Alignment.center,
      child: Text(
        headline,
        style: TextStyle(color: scheme.onPrimaryContainer, fontSize: 28, fontWeight: FontWeight.bold),
      ),
    );
  }
}
