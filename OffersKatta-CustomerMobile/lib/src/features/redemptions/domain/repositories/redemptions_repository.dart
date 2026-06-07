import '../entities/redemption.dart';

abstract class RedemptionsRepository {
  Future<IssuedRedemption> issueFor(String offerId);
  Future<void> cancel(String qrCode);
  Future<List<Redemption>> mine({int page = 1, int limit = 50});
}
