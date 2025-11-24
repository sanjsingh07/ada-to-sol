import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UserDto } from './dto/create-user.dto';
import { DatabaseService } from "src/database/database.service";
import { Prisma, $Enums } from '@prisma/client';
import { generateMnemonic, mnemonicToEntropy, generateNonce } from "@meshsdk/core";
import {
  Bip32PrivateKey,
  BaseAddress,
  NetworkInfo,
  Credential
} from "@emurgo/cardano-serialization-lib-nodejs";
import { Keypair } from '@solana/web3.js';
import bs58 from "bs58";
import { encrypt } from "src/utils/crypto.util";
import * as bip39 from "bip39";

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
      // 1. Generate a 15-word mnemonic
      // Word Count	  Entropy
      // 12        	  128 bits
      // 15        	  160 bits
      // 18           192 bits
      // 21	          224 bits
      // 24           256 bits
      const mnemonic = generateMnemonic(160);

      // 2. Get entropy
      const entropy = bip39.mnemonicToEntropy(mnemonic);
      // 3. Derive root private key (root_xsk)
      const rootPrvKey = Bip32PrivateKey.from_bip39_entropy(
        Buffer.from(entropy, "hex"),
        Buffer.from("") // optional password
      );

      // 3. Derive Cardano payment keys (root → account → payment key)
      const accountKey = rootPrvKey
        .derive(1852 | 0x80000000)
        .derive(1815 | 0x80000000)
        .derive(0 | 0x80000000);

      const paymentPrv = accountKey.derive(0).derive(0);
      const paymentPub = paymentPrv.to_public();

      // 5. Derive stake key (m/1852'/1815'/0'/2/0)
      const stakePrv = accountKey.derive(2).derive(0);
      const stakePub = stakePrv.to_public();

      // convert public keys to key hash
      const paymentCred = Credential.from_keyhash(paymentPub.to_raw_key().hash());
      const stakeCred = Credential.from_keyhash(stakePub.to_raw_key().hash());

      const baseAddr = BaseAddress.new(
        NetworkInfo.mainnet().network_id(),   // or testnet().network_id()
        paymentCred,
        stakeCred // stake key = same for now
      );

      const cardanoAddress = baseAddr.to_address().to_bech32();

      // 5. You only store:
      const encryptedMnemonic = encrypt(mnemonic);

      // solana
      const keypair = Keypair.generate();
      const encryptedSolana = encrypt(bs58.encode(keypair.secretKey));   // 64-byte secret key encoded as base58
      const solanaPubKey = keypair.publicKey.toBase58();

      // we encrypt private ketys using AES-256-GCM

      const newUserObj = {
        walletAddress: createUserDto.walletAddress,
        newCardanoAddress: cardanoAddress,
        cardanoPriKey: encryptedMnemonic.data, // its nmemonic not private key!!!
        cardanoPriKeyIv: encryptedMnemonic.iv,
        cardanoPriKeyTag: encryptedMnemonic.tag,

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
