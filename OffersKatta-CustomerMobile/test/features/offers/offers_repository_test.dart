import 'package:flutter_test/flutter_test.dart';
import 'package:offerskatta_customer/src/core/error/exceptions.dart';
import 'package:offerskatta_customer/src/core/error/failure.dart';
import 'package:offerskatta_customer/src/core/network/api_envelope.dart';
import 'package:offerskatta_customer/src/features/offers/data/datasources/offers_remote_datasource.dart';
import 'package:offerskatta_customer/src/features/offers/data/models/offer_model.dart';
import 'package:offerskatta_customer/src/features/offers/data/repositories/offers_repository_impl.dart';
import 'package:offerskatta_customer/src/features/offers/domain/entities/offer.dart';

class _FakeRemote implements OffersRemoteDataSource {
  _FakeRemote({this.items = const [], this.detail, this.shouldThrow});
  final List<OfferModel> items;
  final OfferModel? detail;
  final ApiException? shouldThrow;
  int clickCount = 0;

  @override
  Future<Paginated<OfferModel>> list({
    String? search, String? categoryId, String? bankId, bool? isFeatured, int page = 1, int limit = 20,
  }) async {
    if (shouldThrow != null) throw shouldThrow!;
    return Paginated(items: items, meta: PageMeta(
      page: page, limit: limit, total: items.length,
      totalPages: 1, hasNext: false, hasPrev: false,
    ));
  }

  @override
  Future<Paginated<OfferModel>> nearby({
    required double latitude, required double longitude, double radiusKm = 10,
    String? categoryId, String? bankId, int page = 1, int limit = 20,
  }) async => list(page: page, limit: limit);

  @override
  Future<OfferModel> getById(String id) async {
    if (shouldThrow != null) throw shouldThrow!;
    return detail!;
  }

  @override
  Future<List<Category>> categories() async => const [
        Category(id: 'c1', name: 'Food & Drink', slug: 'food-drink'),
      ];

  @override
  Future<List<Bank>> banks() async => const [
        Bank(id: 'b1', name: 'HDFC Bank', slug: 'hdfc'),
      ];

  @override
  Future<void> trackClick(String id) async { clickCount++; }

  @override
  Future<void> trackShare(String id) async {}
}

OfferModel _offer({String id = 'o1', String title = 'Sample'}) => OfferModel(
      id: id,
      title: title,
      offerType: 'PERCENTAGE',
      discountValue: 20,
      startsAt: DateTime.now().subtract(const Duration(days: 1)),
      expiresAt: DateTime.now().add(const Duration(days: 30)),
      status: 'PUBLISHED',
      totalRedemptions: 0,
      viewCount: 0,
    );

void main() {
  group('OffersRepositoryImpl', () {
    test('list maps DTOs into entities', () async {
      final remote = _FakeRemote(items: [_offer(id: 'a'), _offer(id: 'b')]);
      final repo = OffersRepositoryImpl(remote);

      final page = await repo.list();
      expect(page.items.length, 2);
      expect(page.items.first, isA<Offer>());
      expect(page.items.first.id, 'a');
    });

    test('list maps NetworkException → NetworkFailure', () async {
      final repo = OffersRepositoryImpl(_FakeRemote(shouldThrow: NetworkException('offline')));
      expect(repo.list(), throwsA(isA<NetworkFailure>()));
    });

    test('list maps UnauthorizedException → AuthFailure', () async {
      final repo = OffersRepositoryImpl(_FakeRemote(shouldThrow: UnauthorizedException('nope')));
      expect(repo.list(), throwsA(isA<AuthFailure>()));
    });

    test('getById returns a single entity', () async {
      final remote = _FakeRemote(detail: _offer(id: 'x', title: 'X'));
      final repo = OffersRepositoryImpl(remote);

      final o = await repo.getById('x');
      expect(o.id, 'x');
      expect(o.title, 'X');
      expect(o.isActive, isTrue);
    });

    test('categories pass through', () async {
      final repo = OffersRepositoryImpl(_FakeRemote());
      final cats = await repo.categories();
      expect(cats.first.slug, 'food-drink');
    });
  });
}
