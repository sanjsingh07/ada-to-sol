import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UserDto } from './dto/create-user.dto';
import { DatabaseService } from "src/database/database.service";
import { Prisma, $Enums } from '@prisma/client';
import { generateNonce } from '@meshsdk/core';
import { generatePrivateKey, toPublicKey } from "@evolution-sdk/lucid";
import { Keypair } from '@solana/web3.js';
import bs58 from "bs58";
import { encrypt } from "src/utils/crypto.util";

@Injectable()
export class UsersService {

  constructor(private readonly databaseService: DatabaseService) {}



  async create(createUserDto: Prisma.UserWalletCreateInput) {

    //creates a new entry in db with createUserDto
    return await this.databaseService.userWallet.create({
      data: createUserDto
    });

  }

  async createOrGetNonce(createUserDto: UserDto) {
    // if new user, create new user model in the database
    let userObj = await this.findOne(createUserDto.walletAddress);

    const nonce = generateNonce('I agree to the term and conditions of the Mesh: ');

    if (!userObj) {
      // create cadano and solana keypair, encrpt it and save it in model

      // cardano
      const cardanoPriKey = generatePrivateKey(); // Bech32 encoded private key
      const cardanoPubKey = toPublicKey(cardanoPriKey); // pubkey
      const encryptedCardano = encrypt(cardanoPriKey);

      // solana
      const keypair = Keypair.generate();
      const encryptedSolana = encrypt(bs58.encode(keypair.secretKey));   // 64-byte secret key encoded as base58
      const solanaPubKey = keypair.publicKey.toBase58();

      // we encrypt private ketys using AES-256-GCM

      const newUserObj = {
        walletAddress: createUserDto.walletAddress,
        newCardanoAddress: cardanoPubKey,
        cardanoPriKey: encryptedCardano.data,
        cardanoPriKeyIv: encryptedCardano.iv,
        cardanoPriKeyTag: encryptedCardano.tag,

        solanaAddress: solanaPubKey,
        solanaPriKey: encryptedSolana.data,
        solanaPriKeyIv: encryptedSolana.iv,
        solanaPriKeyTag: encryptedSolana.tag,
        status: $Enums.AccountStatus.NOT_VERIFIED,
        nonce: nonce,
      }

      await this.create(newUserObj);

      return nonce;
    }

    // do: store 'nonce' in user model in the database // will we take care of this in create method
    userObj.nonce = nonce;
    await this.update(createUserDto.walletAddress, userObj);

    return nonce;
  }

  async incrementTokenVersion(walletAddress: string) {
    return this.databaseService.userWallet.update({
      where: { walletAddress },
      data: { refreshTokenVersion: { increment: 1 } },
    });
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

  async remove(userAddress: string) {
    return `This action removes a #${userAddress} user`;
  }
}
