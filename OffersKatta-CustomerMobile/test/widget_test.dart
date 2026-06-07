// Minimal smoke test — boots the app and ensures the splash spinner renders.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:offerskatta_customer/src/app/app.dart';

void main() {
  testWidgets('App boots without throwing', (WidgetTester tester) async {
    await tester.pumpWidget(const ProviderScope(child: OffersKattaApp()));
    await tester.pump();
    expect(find.byType(CircularProgressIndicator), findsAtLeastNWidgets(1));
  });
}
