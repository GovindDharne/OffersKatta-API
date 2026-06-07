import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';

interface ErrorBody {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  path: string;
  timestamp: string;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { status, code, message, details } = this.normalize(exception);

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} -> ${status} ${code}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    const body: ErrorBody = {
      success: false,
      error: { code, message, details },
      path: request.url,
      timestamp: new Date().toISOString(),
    };

    response.status(status).json(body);
  }

  private normalize(exception: unknown): {
    status: number;
    code: string;
    message: string;
    details?: unknown;
  } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        return { status, code: this.codeFromStatus(status), message: res };
      }
      const r = res as Record<string, unknown>;
      return {
        status,
        code: (r.code as string) ?? this.codeFromStatus(status),
        message: (r.message as string) ?? exception.message,
        details: r.details,
      };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.fromPrisma(exception);
    }

    if (exception instanceof Prisma.PrismaClientValidationError) {
      return {
        status: HttpStatus.BAD_REQUEST,
        code: 'PRISMA_VALIDATION',
        message: 'Invalid query parameters',
      };
    }

    const err = exception as Error;
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_ERROR',
      message: err?.message ?? 'Internal server error',
    };
  }

  private fromPrisma(e: Prisma.PrismaClientKnownRequestError): {
    status: number;
    code: string;
    message: string;
    details?: unknown;
  } {
    switch (e.code) {
      case 'P2002':
        return {
          status: HttpStatus.CONFLICT,
          code: 'CONFLICT',
          message: 'A record with these values already exists',
          details: { target: e.meta?.target },
        };
      case 'P2025':
        return {
          status: HttpStatus.NOT_FOUND,
          code: 'NOT_FOUND',
          message: 'Record not found',
        };
      case 'P2003':
        return {
          status: HttpStatus.CONFLICT,
          code: 'FK_VIOLATION',
          message: 'Foreign key constraint violated',
        };
      default:
        return {
          status: HttpStatus.BAD_REQUEST,
          code: `PRISMA_${e.code}`,
          message: e.message.split('\n').pop() ?? e.message,
        };
    }
  }

  private codeFromStatus(s: number): string {
    return (
      {
        400: 'BAD_REQUEST',
        401: 'UNAUTHORIZED',
        403: 'FORBIDDEN',
        404: 'NOT_FOUND',
        409: 'CONFLICT',
        422: 'UNPROCESSABLE',
        429: 'TOO_MANY_REQUESTS',
      }[s] ?? 'ERROR'
    );
  }
}
