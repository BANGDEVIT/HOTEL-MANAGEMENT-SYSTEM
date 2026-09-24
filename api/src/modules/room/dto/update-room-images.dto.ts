import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsString } from 'class-validator';

export class UpdateRoomImagesDto {
  @ApiProperty({
    example: ['https://bucket.s3.../rooms/abc.jpg'],
    description:
      'Danh sách URL ảnh sau khi sắp xếp và xoá. BE sẽ xoá các ảnh không còn trong danh sách.',
    type: [String],
  })
  @IsArray()
  @ArrayMaxSize(10, { message: 'Mỗi phòng tối đa 10 ảnh' })
  @IsString({ each: true })
  images: string[];
}
