import 'package:flutter_test/flutter_test.dart';
import 'package:offerskatta_customer/src/core/utils/formatters.dart';

void main() {
  group('offerHeadline', () {
    test('formats percentage discounts', () {
      expect(offerHeadline('PERCENTAGE', 20), '20% off');
      expect(offerHeadline('PERCENTAGE', 12.5), '13% off'); // rounded
    });

    test('formats flat discounts in rupees', () {
      expect(offerHeadline('FLAT', 500), '₹500 off');
    });

    test('formats BOGO / free / bundle', () {
      expect(offerHeadline('BUY_ONE_GET_ONE', 100), 'BOGO');
      expect(offerHeadline('FREE_ITEM', 100), 'Free item');
      expect(offerHeadline('BUNDLE', 100), 'Bundle');
    });

    test('falls back for unknown type', () {
      expect(offerHeadline('SOMETHING_NEW', 50), 'Deal');
    });
  });

  group('timeAgo', () {
    test('returns "just now" for very recent times', () {
      expect(timeAgo(DateTime.now().subtract(const Duration(seconds: 5))), 'just now');
    });

    test('returns minutes ago', () {
      expect(timeAgo(DateTime.now().subtract(const Duration(minutes: 5))), '5m ago');
    });

    test('returns hours ago', () {
      expect(timeAgo(DateTime.now().subtract(const Duration(hours: 3))), '3h ago');
    });

    test('returns days ago', () {
      expect(timeAgo(DateTime.now().subtract(const Duration(days: 2))), '2d ago');
    });
  });
}
