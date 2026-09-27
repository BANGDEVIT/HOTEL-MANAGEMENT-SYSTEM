import { PartialType, PickType } from '@nestjs/swagger';
import { CreateGuestDto } from './create-guest.dto';

/**
 * Khách tự sửa hồ sơ của mình.
 * PickType: chỉ lấy đúng các field được phép -> KHÔNG có reward_points, is_active.
 * (Bản cũ có reward_points -> khách tự cộng điểm cho mình được.)
 */
export class UpdateCustomerProfileDto extends PartialType(
  PickType(CreateGuestDto, [
    'first_name',
    'last_name',
    'phone',
    'email',
    'id_type',
    'id_card',
    'nationality',
  ] as const),
) {}

// as const giữ các tên field ở dạng literal type ('first_name' | 'last_name' | ...) thay vì string[]
