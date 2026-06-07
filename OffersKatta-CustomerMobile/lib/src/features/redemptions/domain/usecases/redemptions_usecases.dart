import '../entities/redemption.dart';
import '../repositories/redemptions_repository.dart';

class IssueRedemptionUseCase {
  IssueRedemptionUseCase(this._repo);
  final RedemptionsRepository _repo;
  Future<IssuedRedemption> call(String offerId) => _repo.issueFor(offerId);
}

class CancelRedemptionUseCase {
  CancelRedemptionUseCase(this._repo);
  final RedemptionsRepository _repo;
  Future<void> call(String qrCode) => _repo.cancel(qrCode);
}

class MyRedemptionsUseCase {
  MyRedemptionsUseCase(this._repo);
  final RedemptionsRepository _repo;
  Future<List<Redemption>> call() => _repo.mine();
}
