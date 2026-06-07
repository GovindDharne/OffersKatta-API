import 'package:intl/intl.dart';

import '../constants/api_constants.dart';

/// Turns a possibly-relative asset/image path returned by the API
/// (e.g. `/api/uploads/files/foo.jpg`) into a fully-qualified URL that
/// Flutter's network image loader can fetch. Pass-through for null,
/// empty, or already-absolute http(s) URLs.
String? resolveAssetUrl(String? path) {
  if (path == null || path.isEmpty) return path;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  final base = Uri.parse(ApiConstants.baseUrl);
  final origin = '${base.scheme}://${base.authority}';
  return path.startsWith('/') ? '$origin$path' : '$origin/$path';
}

String formatCurrency(num amount, {String currency = 'INR', String locale = 'en_IN'}) {
  try {
    return NumberFormat.simpleCurrency(name: currency, locale: locale).format(amount);
  } catch (_) {
    return '$currency ${amount.toStringAsFixed(0)}';
  }
}

String formatDate(DateTime date) => DateFormat.yMMMd().format(date);

String timeAgo(DateTime date) {
  final diff = DateTime.now().difference(date);
  if (diff.inSeconds < 60) return 'just now';
  if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
  if (diff.inHours < 24) return '${diff.inHours}h ago';
  if (diff.inDays < 7) return '${diff.inDays}d ago';
  return formatDate(date);
}

String offerHeadline(String offerType, num discountValue) {
  switch (offerType) {
    case 'PERCENTAGE': return '${discountValue.round()}% off';
    case 'FLAT': return '₹${discountValue.round()} off';
    case 'BUY_ONE_GET_ONE': return 'BOGO';
    case 'FREE_ITEM': return 'Free item';
    case 'BUNDLE': return 'Bundle';
    default: return 'Deal';
  }
}
