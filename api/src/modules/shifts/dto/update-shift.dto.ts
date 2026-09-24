import { PartialType } from '@nestjs/swagger';
import { CreateShiftDto } from './create-shift.dto';

// PartialType của @nestjs/swagger (không phải @nestjs/mapped-types)
// -> giữ nguyên validator + Swagger, chỉ đổi mọi field thành optional
export class UpdateShiftDto extends PartialType(CreateShiftDto) {}
