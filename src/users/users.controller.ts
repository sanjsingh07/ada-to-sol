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

    // return this.usersService.create(createUserDto);
    return 'placeholderreturn';
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

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(+id, updateUserDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.usersService.remove(+id);
  }
}
