/// Domain-layer error surface — UI listens to these.
abstract class Failure implements Exception {
  Failure(this.message);
  final String message;
  @override
  String toString() => message;
}

class NetworkFailure extends Failure { NetworkFailure(super.message); }
class AuthFailure extends Failure { AuthFailure(super.message); }
class ServerFailure extends Failure {
  ServerFailure(super.message, {this.statusCode, this.code});
  final int? statusCode;
  final String? code;
}
class ValidationFailure extends Failure { ValidationFailure(super.message); }
