import { Controller, Get, Post, Body, Patch, Param, Delete, Query, Req } from '@nestjs/common';
import { UsersService } from './users.service';
import { UserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Public } from 'src/auth/decorators/public.decorator';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
  ) {}

  @Post('create')
  @Public()
  create(@Body() createUserDto: UserDto) {
    // maybe add check for correct cardano pubkey in dto?
    return this.usersService.createOrGetNonce(createUserDto);
  }

  @Get('fetch-deposit-address')
  async fetchDepositAddr(@Req() req: any){
    const walletAddress = req.user.sub;
    let userObj = await this.usersService.findOne(walletAddress);
    return { depositAddress: userObj?.newCardanoAddress};
  }

  @Get()
  findAll(@Query('status') status? : 'VERIFIED' | 'NOT_VERIFIED') {
    return this.usersService.findAll(status);
    // return this.usersService.findAll();
  }

  @Get(':userAddress')
  findOne(@Param('userAddress') userAddress: string) {
    return this.usersService.findOne(userAddress);
  }

  @Patch(':userAddress')
  update(@Param('userAddress') userAddress: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(userAddress, updateUserDto);
  }

  @Delete(':userAddress')
  remove(@Param('userAddress') userAddress: string) {
    return this.usersService.remove(userAddress);
  }
}
