// Minimal smoke test — boots the app inside a ProviderScope and checks the
// splash spinner renders. Replace with real tests as the app grows.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:offerskatta_seller/src/app/app.dart';

void main() {
  testWidgets('App boots without throwing', (WidgetTester tester) async {
    await tester.pumpWidget(const ProviderScope(child: OffersKattaSellerApp()));
    // Pump one frame; the router redirects to /splash which shows a spinner.
    await tester.pump();
    expect(find.byType(CircularProgressIndicator), findsAtLeastNWidgets(1));
  });
}
