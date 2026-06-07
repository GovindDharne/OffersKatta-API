/// Thrown by the data layer when the API call fails for any reason.
class ApiException implements Exception {
  ApiException(this.message, {this.statusCode, this.code, this.details});
  final String message;
  final int? statusCode;
  final String? code;
  final Object? details;

  @override
  String toString() => 'ApiException($statusCode $code): $message';
}

class NetworkException extends ApiException {
  NetworkException(super.message);
}

class UnauthorizedException extends ApiException {
  UnauthorizedException(super.message) : super(statusCode: 401);
}
