import { AuthService } from './auth.service';
import { Controller, Post, Body } from "@nestjs/common";
import { UserSginatureDto } from './decorators/verify-user.dto';
import { Public } from './decorators/public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('verify-signature')
  @Public()
  verifySignature(@Body() userSginatureDto: UserSginatureDto){
    return this.authService.backendVerifySignature(userSginatureDto);
  }

  @Post('refresh')
  @Public()
  async refresh(@Body() body: { refreshToken: string }) {
    return this.authService.refreshTokens(body.refreshToken);
  }
}
