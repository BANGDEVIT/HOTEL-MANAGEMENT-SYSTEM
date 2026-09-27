import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch() // bắt tất cả mọi loại exception
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttp = exception instanceof HttpException;
    const statusCode = isHttp
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    // Lỗi KHÔNG lường trước (Prisma, S3, Redis, bug trong code...) -> in đủ stack ra terminal.
    // Người dùng chỉ thấy "Internal server error", còn nguyên nhân thật nằm ở đây.
    if (!isHttp) {
      this.logger.error(
        `${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(statusCode).json({
      success: false,
      statusCode,
      message: isHttp
        ? this.extractMessage(exception)
        : 'Internal server error',
      data: null,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * ValidationPipe ném BadRequestException với message là MẢNG các lỗi,
   * còn exception.message chỉ là "Bad Request Exception" -> FE mất câu lỗi thật.
   * Lấy từ getResponse() để giữ nguyên câu lỗi đã viết trong DTO.
   */
  private extractMessage(exception: HttpException): string {
    const body = exception.getResponse();
    if (typeof body === 'string') return body;

    const msg = (body as { message?: string | string[] }).message;
    if (Array.isArray(msg)) return msg[0] ?? exception.message; // FE chỉ cần hiện lỗi đầu tiên
    return msg ?? exception.message;
  }
}
