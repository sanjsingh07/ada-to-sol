import { Injectable, UnauthorizedException, forwardRef, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { Prisma } from "@prisma/client";
import { UserSginatureDto } from './decorators/verify-user.dto';
import { checkSignature } from '@meshsdk/core';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwt: JwtService,
    private readonly usersService: UsersService,
  ) {}

    async backendVerifySignature(userDto: UserSginatureDto ) {

        let userObj = await this.usersService.findOne(userDto.walletAddress);
        if (!userObj) throw new UnauthorizedException('User not found');

        // uncomment this when JWT testing is done 
        const result = await checkSignature(userObj?.nonce!, userDto.signature, userDto.walletAddress);

        /**
         * 
         * only setting result for TESTING purpose
         * 
         */
        // const result = true;

        if(result){

        const jwtToken = await this.generateTokens(userObj)

        return jwtToken;
        }
        else{
        throw new UnauthorizedException('Invalid or incorret signature');
        }

  }

  // Issue new token pair
  async generateTokens(user: Prisma.UserWalletCreateInput) {
    const payload = {
      sub: user.walletAddress,
      version: user.refreshTokenVersion,
    };

    const accessToken = await this.jwt.signAsync(payload, {
      secret: process.env.JWT_SECRET,
      expiresIn: '5m',
    });

    const refreshToken = await this.jwt.signAsync(payload, {
      secret: process.env.JWT_SECRET,
      expiresIn: '30m',
    });

    return { accessToken, refreshToken };
  }

  // When refreshing
  async refreshTokens(refreshToken: string) {
    let decoded;
    try {
      decoded = await this.jwt.verifyAsync(refreshToken, {
        secret: process.env.JWT_SECRET,
      });
    } catch (err) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.usersService.findOne(decoded.sub);
    if (!user) throw new UnauthorizedException('User not found');

    // Compare refresh token version
    if (decoded.version !== user.refreshTokenVersion) {
      throw new UnauthorizedException('Refresh token no longer valid');
    }

    // Increment refresh token version in DB so the old token becomes invalid
    const updatedUser = await this.usersService.incrementTokenVersion(user.walletAddress);

    // Issue new pair
    return this.generateTokens(updatedUser);
  }
}
