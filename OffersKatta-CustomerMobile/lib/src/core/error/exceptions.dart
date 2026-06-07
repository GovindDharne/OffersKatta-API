/// Data-layer exceptions. Repository implementations catch these and convert
/// them into [Failure] instances before returning to the domain layer.
class ApiException implements Exception {
  ApiException(this.message, {this.statusCode, this.code, this.details});
  final String message;
  final int? statusCode;
  final String? code;
  final Object? details;

  @override
  String toString() => 'ApiException($statusCode $code): $message';
}

class UnauthorizedException extends ApiException {
  UnauthorizedException(super.message) : super(statusCode: 401, code: 'UNAUTHORIZED');
}

class NetworkException extends ApiException {
  NetworkException(super.message);
}

class CacheException extends ApiException {
  CacheException(super.message);
}
