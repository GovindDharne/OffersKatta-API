/// Domain-layer error envelope. The presentation layer maps these to UI.
sealed class Failure {
  const Failure(this.message);
  final String message;

  @override
  String toString() => '$runtimeType($message)';
}

class NetworkFailure extends Failure {
  const NetworkFailure(super.message);
}

class ServerFailure extends Failure {
  const ServerFailure(super.message, {this.statusCode, this.code});
  final int? statusCode;
  final String? code;
}

class AuthFailure extends Failure {
  const AuthFailure(super.message);
}

class ValidationFailure extends Failure {
  const ValidationFailure(super.message, {this.fieldErrors});
  final Map<String, String>? fieldErrors;
}

class UnknownFailure extends Failure {
  const UnknownFailure(super.message);
}
