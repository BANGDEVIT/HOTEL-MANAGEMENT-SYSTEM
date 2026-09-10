import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDTO } from './dto/register.dto';
import { RegisterResponseDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { Request, Response } from 'express';
import { GetAccount } from '../../common/decorators/get-account.decorator';
import { Public } from '../../common/decorators/public.decorator';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post('register')
  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  @HttpCode(201)
  @ApiOperation({
    summary: 'Đăng ký tài khoản',
    description: 'Tạo tài khoản mới cho khách hàng',
  })
  @ApiResponse({
    status: 201,
    description: 'Đăng ký thành công',
    type: RegisterResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  @ApiResponse({ status: 409, description: 'Email đã tồn tại' })
  @ApiResponse({ status: 500, description: 'Lỗi server' })
  async register(
    @Body() registerdto: RegisterDTO,
  ): Promise<RegisterResponseDto> {
    return this.authService.register(registerdto);
  }

  @Public()
  @Post('login')
  @Throttle({ default: { ttl: 60_000, limit: 5 } }) // // ← Login: max 5 lần/phút
  @HttpCode(200)
  @ApiOperation({
    summary: 'Đăng nhập',
    description:
      'Đăng nhập và nhận access token. Refresh token được lưu trong HttpOnly Cookie',
  })
  @ApiResponse({
    status: 200,
    description: 'Đăng nhập thành công — trả về accessToken',
  })
  @ApiResponse({ status: 401, description: 'Email hoặc mật khẩu không đúng' })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken, account } =
      await this.authService.login(loginDto);

    res.cookie('refresh-token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 ngày
    });

    // nếu ko có passthrough: true  Phải tự gửi response thủ công
    // res.json({ accessToken }); // ← phải làm thế này

    return {
      accessToken: accessToken,
      account: account,
    };
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  @ApiCookieAuth('refresh-token')
  @ApiOperation({
    summary: 'Refresh access token',
    description: 'Lấy access token mới từ refresh token trong cookie',
  })
  @ApiResponse({ status: 200, description: 'Trả về accessToken mới' })
  @ApiResponse({
    status: 401,
    description: 'Refresh token không hợp lệ hoặc hết hạn',
  })
  async refresh(@Req() req: Request) {
    // ← Lấy refresh token từ cookie
    // const refreshToken = req.cookies['refresh_token'];
    const refreshToken = req.cookies['refresh-token'];

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token không tồn tại');
    }

    const { accessToken } = await this.authService.refreshToken(refreshToken);

    return { accessToken };
  }

  @Post('logout')
  @HttpCode(204)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Đăng xuất',
    description: 'Đăng xuất và thu hồi refresh token',
  })
  @ApiResponse({ status: 204, description: 'Đăng xuất thành công' })
  @ApiResponse({
    status: 401,
    description: 'Chưa đăng nhập hoặc token hết hạn',
  })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @GetAccount('sub') accountId: string,
  ) {
    const refreshToken = req.cookies['refresh-token'];
    const accessToken = (req.headers as any).authorization
      ?.replace('Bearer ', '')
      .trim();

    await this.authService.logout(accountId, refreshToken, accessToken);

    res.clearCookie('refresh-token');
  }

  @Post('logout')
  @HttpCode(204)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Đăng xuất',
    description: 'Đăng xuất và thu hồi refresh token',
  })
  @ApiResponse({ status: 204, description: 'Đăng xuất thành công' })
  @ApiResponse({
    status: 401,
    description: 'Chưa đăng nhập hoặc token hết hạn',
  })
  async logoutV2(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @GetAccount() payload: { sub: string; roles: string[]; exp: number },
  ) {
    const refreshToken = req.cookies['refresh-token'];
    const accessToken = (req.headers as any).authorization
      ?.replace('Bearer ', '')
      .trim();

    await this.authService.logoutV2(payload, refreshToken, accessToken);

    res.clearCookie('refresh-token');
  }
}
