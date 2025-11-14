import { Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { DatabaseService } from "src/database/database.service";
import { Prisma } from '@prisma/client';

import { generateNonce } from '@meshsdk/core';


@Injectable()
export class UsersService {

  constructor(private readonly databaseService: DatabaseService) {}



  async create(createUserDto: Prisma.UserWalletCreateInput) {

    // let new_user: Prisma.UserWalletCreateInput = {}

    //creates a new entry in db with createUserDto
    await this.databaseService.userWallet.create({
      data: createUserDto
    })
    return 'This action adds a new user';
  }

    async createOrGetNonce(userAddress: string) {
    // if new user, create new user model in the database
    let userObj = await this.findOne(userAddress);

    if (!userObj) {
        // create cadano and solana keypair, encrpt it and save it in model
    }

    const nonce = generateNonce('I agree to the term and conditions of the Mesh: ');

    // do: store 'nonce' in user model in the database // will we take care of this in create method

    return nonce;
  }

  async findAll() {
    return `This action returns all users`;
  }

  async findOne(userAddress: string) {
    return await this.databaseService.userWallet.findUnique({
      where: {
        walletAddress: userAddress,
      }
    });
  }

  async update(id: number, updateUserDto: UpdateUserDto) {
    return `This action updates a #${id} user`;
  }

  async remove(id: number) {
    return `This action removes a #${id} user`;
  }
}
