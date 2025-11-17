import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Prisma } from '@prisma/client';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  create(@Body() createUserDto: CreateUserDto) {
    // check if cardano pub-key is correct

    // we will call nonce function here
    // add authentication

    return this.usersService.createOrGetNonce(createUserDto);
  }

  @Get()
  findAll(@Query('status') status? : 'VERIFIED' | 'NOT_VERIFIED') {
    // return this.usersService.findAll(status);
    return this.usersService.findAll();
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
