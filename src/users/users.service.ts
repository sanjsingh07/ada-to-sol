import { Injectable } from '@nestjs/common';
// import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { DatabaseService } from "src/database/database.service";
import { Prisma, $Enums } from '@prisma/client';
import { generateNonce } from '@meshsdk/core';
import { generatePrivateKey, toPublicKey } from "@evolution-sdk/lucid";
import { Keypair } from '@solana/web3.js';


@Injectable()
export class UsersService {

  constructor(private readonly databaseService: DatabaseService) {}



  async create(createUserDto: Prisma.UserWalletCreateInput) {

    //creates a new entry in db with createUserDto
    return await this.databaseService.userWallet.create({
      data: createUserDto
    });
  }

    async createOrGetNonce(userAddress: string) {
    // if new user, create new user model in the database
    let userObj = await this.findOne(userAddress);

    const nonce = generateNonce('I agree to the term and conditions of the Mesh: ');

    if (!userObj) {
        // create cadano and solana keypair, encrpt it and save it in model

        // cardano
        const cardanoPriKey = generatePrivateKey(); // Bech32 encoded private key
        const cardanoPubKey = toPublicKey(cardanoPriKey); // pubkey

        // solana
        const keypair = Keypair.generate();
        const solanaPriKey = keypair.secretKey.toString();
        const solanaPubKey = keypair.publicKey.toBase58();

        // we should encrypt them here, but for the moment lets skip it
        // we need to define how we want to encrypt it

        const newUserObj = {
          walletAddress: userAddress,
          newCardanoAddress: cardanoPubKey,
          newCardanoEnPriKey: cardanoPriKey, // NOT ENCRIPTED YET!!!
          solanaAddress: solanaPubKey,
          solanaEnPriKey: solanaPriKey, // NOT ENCRIPTED YET!!!
          status: $Enums.AccountStatus.NOT_VERIFIED,
          nonce: nonce,
        }

        return await this.create(newUserObj);
    }

    // do: store 'nonce' in user model in the database // will we take care of this in create method

    return nonce;
  }

  async findAll(status?: 'NOT_VERIFIED' | 'VERIFIED') {
    if (status) return this.databaseService.userWallet.findMany({
      where: {
        status,
      }
    })
    return this.databaseService.userWallet.findMany();
  }

  async findOne(userAddress: string) {
    return await this.databaseService.userWallet.findUnique({
      where: {
        walletAddress: userAddress,
      }
    });
  }

  async update(walletAddress: string, updateUserDto: Prisma.UserWalletUpdateInput) {
    return this.databaseService.userWallet.update({
      where: {
        walletAddress,
      },
      data: updateUserDto,
    });
  }

  async remove(id: number) {
    return `This action removes a #${id} user`;
  }
}
