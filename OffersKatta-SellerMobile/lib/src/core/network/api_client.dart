import 'package:dio/dio.dart';

import '../constants/api_constants.dart';
import '../error/exceptions.dart';
import 'api_envelope.dart';
import 'token_storage.dart';

/// Thin Dio wrapper that:
///   - injects the bearer token on each request
///   - on a 401, attempts a single in-flight refresh and retries the original
///   - decodes the success envelope and throws ApiException on failure
class ApiClient {
  ApiClient({required Dio dio, required TokenStorage tokens})
      : _dio = dio,
        _tokens = tokens {
    _dio
      ..options.baseUrl = ApiConstants.baseUrl
      ..options.connectTimeout = ApiConstants.connectTimeout
      ..options.receiveTimeout = ApiConstants.receiveTimeout
      ..options.headers = {'Content-Type': 'application/json'}
      ..interceptors.add(_AuthInterceptor(this));
  }

  final Dio _dio;
  final TokenStorage _tokens;
  Future<bool>? _refreshing;

  Dio get raw => _dio;
  TokenStorage get tokens => _tokens;

  Future<T> get<T>(String path,
      {Map<String, dynamic>? query, T Function(dynamic)? decode}) async {
    final res = await _safe(() => _dio.get<dynamic>(path, queryParameters: query));
    return _unwrap<T>(res, decode);
  }

  Future<Paginated<T>> getPaginated<T>(String path,
      {Map<String, dynamic>? query, required T Function(Map<String, dynamic>) fromJson}) async {
    final res = await _safe(() => _dio.get<dynamic>(path, queryParameters: query));
    final body = res.data;
    if (body is! Map<String, dynamic>) throw ApiException('Unexpected response shape');
    if (body['success'] != true) throw _fromErrorBody(body, res.statusCode);
    final List<dynamic> raw = (body['data'] as List<dynamic>?) ?? const [];
    final items = raw.map((e) => fromJson(e as Map<String, dynamic>)).toList(growable: false);
    final meta = body['meta'] is Map<String, dynamic>
        ? PageMeta.fromJson(body['meta'] as Map<String, dynamic>)
        : PageMeta(page: 1, limit: items.length, total: items.length, totalPages: 1, hasNext: false, hasPrev: false);
    return Paginated<T>(items: items, meta: meta);
  }

  Future<T> post<T>(String path,
      {Object? body, Map<String, dynamic>? query, T Function(dynamic)? decode}) async {
    final res = await _safe(() => _dio.post<dynamic>(path, data: body, queryParameters: query));
    return _unwrap<T>(res, decode);
  }

  Future<T> patch<T>(String path, {Object? body, T Function(dynamic)? decode}) async {
    final res = await _safe(() => _dio.patch<dynamic>(path, data: body));
    return _unwrap<T>(res, decode);
  }

  Future<T> delete<T>(String path, {T Function(dynamic)? decode}) async {
    final res = await _safe(() => _dio.delete<dynamic>(path));
    return _unwrap<T>(res, decode);
  }

  /// Multipart upload of a single file. Returns the parsed `data` envelope.
  /// Cross-platform multipart upload. Pass the file's bytes (works on web,
  /// mobile, desktop) plus a filename so the server gets a sensible name.
  /// IMPORTANT: use `contentType:` (not `headers:`) so Dio appends the
  /// multipart boundary correctly; setting Content-Type via headers strips it
  /// and the server fails to parse the body.
  Future<T> upload<T>(String path,
      {required List<int> bytes,
      required String filename,
      required String field,
      T Function(dynamic)? decode}) async {
    final form = FormData.fromMap({
      field: MultipartFile.fromBytes(bytes, filename: filename),
    });
    final res = await _safe(() => _dio.post<dynamic>(path,
        data: form,
        options: Options(contentType: 'multipart/form-data')));
    return _unwrap<T>(res, decode);
  }

  Future<Response<dynamic>> _safe(Future<Response<dynamic>> Function() fn) async {
    try {
      return await fn();
    } on DioException catch (e) {
      throw _fromDio(e);
    }
  }

  T _unwrap<T>(Response<dynamic> res, T Function(dynamic)? decode) {
    final body = res.data;
    if (body is Map<String, dynamic>) {
      if (body['success'] == true) {
        final data = body['data'];
        if (decode != null) return decode(data);
        return data as T;
      }
      throw _fromErrorBody(body, res.statusCode);
    }
    // 204 No Content
    if (decode != null) return decode(null);
    return body as T;
  }

  ApiException _fromErrorBody(Map<String, dynamic> body, int? status) {
    final err = body['error'];
    if (err is Map<String, dynamic>) {
      // Nest's ValidationPipe returns `message` as a List<String> of field errors
      // (e.g. ["latitude must be ...", "phone must be ..."]) — flatten it.
      final raw = err['message'];
      final message = raw is List
          ? raw.map((e) => e.toString()).join('; ')
          : (raw?.toString() ?? 'Request failed');
      return ApiException(
        message,
        statusCode: status,
        code: err['code'] as String?,
        details: err['details'],
      );
    }
    return ApiException('Request failed', statusCode: status);
  }

  ApiException _fromDio(DioException e) {
    if (e.type == DioExceptionType.connectionError || e.type == DioExceptionType.connectionTimeout) {
      return NetworkException('Could not reach the server');
    }
    if (e.response?.statusCode == 401) {
      String msg = 'Unauthorized';
      if (e.response?.data is Map && (e.response!.data['error'] is Map)) {
        final raw = (e.response!.data['error'] as Map)['message'];
        msg = raw is List ? raw.map((e) => e.toString()).join('; ') : (raw?.toString() ?? msg);
      }
      return UnauthorizedException(msg);
    }
    final body = e.response?.data;
    if (body is Map<String, dynamic>) return _fromErrorBody(body, e.response?.statusCode);
    return ApiException(e.message ?? 'Unknown error', statusCode: e.response?.statusCode);
  }

  /// One in-flight refresh shared across concurrent 401s.
  Future<bool> ensureRefresh() {
    return _refreshing ??= _doRefresh().whenComplete(() => _refreshing = null);
  }

  Future<bool> _doRefresh() async {
    final refresh = await _tokens.readRefresh();
    if (refresh == null) return false;
    try {
      final res = await Dio(BaseOptions(baseUrl: ApiConstants.baseUrl)).post<Map<String, dynamic>>(
        ApiConstants.authRefresh,
        data: {'refreshToken': refresh},
        options: Options(headers: {'Content-Type': 'application/json'}),
      );
      final body = res.data;
      if (body == null || body['success'] != true) return false;
      final data = body['data'] as Map<String, dynamic>;
      await _tokens.save(
        accessToken: data['accessToken'] as String,
        refreshToken: data['refreshToken'] as String,
      );
      return true;
    } catch (_) {
      await _tokens.clear();
      return false;
    }
  }
}

class _AuthInterceptor extends Interceptor {
  _AuthInterceptor(this._client);
  final ApiClient _client;

  @override
  Future<void> onRequest(RequestOptions options, RequestInterceptorHandler handler) async {
    if (options.extra['skipAuth'] != true) {
      final token = await _client.tokens.readAccess();
      if (token != null) options.headers['Authorization'] = 'Bearer $token';
    }
    handler.next(options);
  }

  @override
  Future<void> onError(DioException err, ErrorInterceptorHandler handler) async {
    final req = err.requestOptions;
    if (err.response?.statusCode == 401 && req.extra['retried'] != true) {
      final ok = await _client.ensureRefresh();
      if (ok) {
        req.extra['retried'] = true;
        final newToken = await _client.tokens.readAccess();
        if (newToken != null) req.headers['Authorization'] = 'Bearer $newToken';
        try {
          final retry = await _client.raw.fetch<dynamic>(req);
          return handler.resolve(retry);
        } catch (e) {
          if (e is DioException) return handler.next(e);
        }
      }
    }
    handler.next(err);
  }
}
