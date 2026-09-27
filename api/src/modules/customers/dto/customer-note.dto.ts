import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { trimString } from './create-guest.dto';

export class CreateCustomerNoteDto {
  @ApiProperty({ example: 'Thích phòng tầng cao, hay nhận phòng sau 22 giờ' })
  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty({ message: 'Nội dung ghi chú không được để trống' })
  @MaxLength(500, { message: 'Ghi chú tối đa 500 ký tự' })
  content: string;
}

export class NoteAuthorDto {
  @ApiProperty() id: string;
  @ApiProperty({ example: 'Nguyễn Thị Lan' }) full_name: string;
}

export class CustomerNoteDto {
  @ApiProperty() id: string;
  @ApiProperty() content: string;
  @ApiProperty() created_at: Date;
  @ApiProperty({ type: NoteAuthorDto }) author: NoteAuthorDto;
}
