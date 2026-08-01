import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { BaseExceptionFilter, HttpAdapterHost } from '@nestjs/core';
import { GqlArgumentsHost, GqlContextType } from '@nestjs/graphql';
import { GraphQLError, responsePathAsArray } from 'graphql';
import { DomainError } from '../domain';

type ErrorDetails = Record<string, unknown> | string[] | string;

@Catch()
export class GraphqlExceptionFilter extends BaseExceptionFilter {
  private readonly logger = new Logger(GraphqlExceptionFilter.name);

  constructor(httpAdapterHost: HttpAdapterHost) {
    super(httpAdapterHost.httpAdapter);
  }

  catch(exception: unknown, host: ArgumentsHost) {
    if (host.getType<GqlContextType>() !== 'graphql') {
      return super.catch(exception, host);
    }

    const gqlHost = GqlArgumentsHost.create(host);
    const info = gqlHost.getInfo();
    const context = gqlHost.getContext<{
      req?: { body?: { operationName?: string } };
    }>();

    const operationName =
      context?.req?.body?.operationName ||
      info?.operation?.name?.value ||
      info?.fieldName ||
      'UnknownOperation';

    const path = info?.path ? responsePathAsArray(info.path) : undefined;
    const normalized = this.normalizeException(exception);

    const logPayload = {
      operationName,
      field: info?.fieldName,
      status: normalized.status,
      code: normalized.code,
      message: normalized.message,
      details: normalized.details,
    };

    this.logger.error(
      `GraphQL Error: ${JSON.stringify(logPayload)}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    return new GraphQLError(normalized.message, {
      path,
      extensions: {
        code: normalized.code,
        status: normalized.status,
        details: normalized.details,
        operation: operationName,
        timestamp: new Date().toISOString(),
      },
    });
  }

  private normalizeException(exception: unknown): {
    message: string;
    status: number;
    code: string;
    details?: ErrorDetails;
  } {
    if (exception instanceof GraphQLError) {
      const status =
        typeof exception.extensions?.status === 'number'
          ? exception.extensions.status
          : HttpStatus.INTERNAL_SERVER_ERROR;
      const code =
        typeof exception.extensions?.code === 'string'
          ? exception.extensions.code
          : this.mapStatusToCode(status);

      return {
        message: exception.message,
        status,
        code,
        details: exception.extensions?.details as ErrorDetails | undefined,
      };
    }

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let details: ErrorDetails | undefined;

    if (exception instanceof DomainError) {
      status = exception.statusCode;
      message = exception.message;
      details = exception.details;
      return {
        message,
        status,
        code: exception.code,
        details,
      };
    }

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const response = exception.getResponse();
      const normalized = this.normalizeHttpResponse(response);
      if (normalized.message) {
        message = normalized.message;
      } else if (exception.message) {
        message = exception.message;
      }
      if (normalized.details !== undefined) {
        details = normalized.details;
      }
    } else if (exception instanceof Error && exception.message) {
      message = exception.message;
    }

    return {
      message,
      status,
      code: this.mapStatusToCode(status),
      details,
    };
  }

  private normalizeHttpResponse(response: unknown): {
    message?: string;
    details?: ErrorDetails;
  } {
    if (typeof response === 'string') {
      return { message: response };
    }

    if (!response || typeof response !== 'object') {
      return {};
    }

    const responseObj = response as Record<string, unknown>;
    const rawMessage = responseObj.message;
    const rawError = responseObj.error;

    let details: ErrorDetails | undefined;
    let message: string | undefined;

    if (rawMessage !== undefined) {
      if (typeof rawMessage === 'string') {
        message = rawMessage;
      } else {
        details = rawMessage as ErrorDetails;
        message = this.extractDetailsMessage(rawMessage);
      }
    }

    if (!message && typeof rawError === 'string') {
      message = rawError;
    }

    return { message, details };
  }

  private extractDetailsMessage(details: unknown): string | undefined {
    if (typeof details === 'string') {
      return details;
    }

    if (Array.isArray(details)) {
      const parts = details
        .map((item) => this.extractDetailsMessage(item))
        .filter((item): item is string => Boolean(item));
      return parts.length ? parts.join(', ') : undefined;
    }

    if (details && typeof details === 'object') {
      const parts = Object.values(details)
        .map((item) => this.extractDetailsMessage(item))
        .filter((item): item is string => Boolean(item));
      return parts.length ? parts.join(', ') : undefined;
    }

    return undefined;
  }

  private mapStatusToCode(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
      case HttpStatus.UNPROCESSABLE_ENTITY:
        return 'BAD_USER_INPUT';
      case HttpStatus.UNAUTHORIZED:
        return 'UNAUTHENTICATED';
      case HttpStatus.FORBIDDEN:
        return 'FORBIDDEN';
      case HttpStatus.NOT_FOUND:
        return 'NOT_FOUND';
      case HttpStatus.CONFLICT:
        return 'CONFLICT';
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'TOO_MANY_REQUESTS';
      default:
        return status >= 500 ? 'INTERNAL_SERVER_ERROR' : 'BAD_REQUEST';
    }
  }
}
