import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';

@Injectable()
export class S3Service {
  private s3Client: S3Client;
  private bucket: string;
  private region: string;

  private readonly ALLOWED_MIME_TYPES = [
    'image/jpeg',
    'image/png',
    'image/webp',
  ];
  private readonly MAX_FILE_SIZE = 5 * 1024 * 1024;

  constructor(private configService: ConfigService) {
    this.region = this.configService.get<string>('AWS_REGION');
    this.bucket = this.configService.get<string>('AWS_S3_BUCKET');

    this.s3Client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID'),
        secretAccessKey: this.configService.get<string>(
          'AWS_SECRET_ACCESS_KEY',
        ),
      },
    });
  }

  async uploadFile(file: Express.Multer.File, folder: string): Promise<string> {
    if (!this.ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException('Chỉ chấp nhận file jpeg, png, webp');
    }

    if (file.size > this.MAX_FILE_SIZE) {
      throw new BadRequestException('File không được vượt quá 5MB');
    }

    const ext = file.originalname.split('.').pop();
    const key = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const upload = new Upload({
      client: this.s3Client,
      params: {
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      },
    });

    await upload.done();

    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
  }

  async deleteFile(url: string): Promise<void> {
    if (!url) return;
    const key = url.split('.amazonaws.com/')[1];
    if (!key) return;

    await this.s3Client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );
  }

  async uploadMultiple(
    files: Express.Multer.File[],
    folder: string,
  ): Promise<string[]> {
    if (files?.length) return;
    // Kiểm tra toàn bộ trước khi upload — tránh trường hợp
    // upload được 2 file rồi file thứ 3 sai định dạng, để lại rác trên S3
    for (const file of files) {
      if (!this.ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        throw new BadRequestException(
          `File ${file.originalname} không đúng định dạng. Chỉ nhận jpeg, png, webp`,
        );
      }
      if (file.size > this.MAX_FILE_SIZE) {
        throw new BadRequestException(`File ${file.originalname} vượt quá 5MB`);
      }

      const upLoaded: string[] = [];

      try {
        for (const file of files) {
          const url = await this.uploadFile(file, folder);
          upLoaded.push(url);
        }
        return upLoaded;
      } catch (error) {
        await Promise.allSettled(upLoaded.map((url) => this.deleteFile(url)));
        throw error;
      }
    }
  }

  /** Xoá nhiều file, bỏ qua lỗi từng cái — dùng khi dọn ảnh cũ */
  async deleteMultiple(urls: string[]): Promise<void> {
    if (!urls?.length) return;
    await Promise.allSettled(urls.map((url) => this.deleteFile(url)));
  }

  // Promise.all : (Fail-fast — dừng ngay, trả về reject với lỗi đầu tiên gặp phải) (Chỉ có giá trị nếu tất cả đều thành công)
  // Promise.allSettled : (Vẫn chạy tiếp tất cả, không bị dừng) (Luôn trả về mảng kết quả của từng promise, dù thành công hay thất bại)
}
