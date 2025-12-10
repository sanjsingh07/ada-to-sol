import { Injectable, Logger, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import bs58 from 'bs58';
import nacl from 'tweetnacl';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from 'src/database/database.service';
import { decrypt } from 'src/utils/crypto.util';

@Injectable()
export class OrderlyService {
  private readonly logger = new Logger(OrderlyService.name);
  private readonly baseUrl: string;

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
    private readonly database: DatabaseService,
  ) {
    this.baseUrl = this.config.get<string>('ORDERLY_BASE_URL') ?? 'https://testnet-api.orderly.org';
  }

  async getRegistrationNonce() {
    const url = `${this.baseUrl}/v1/registration_nonce`;
    try {
      const res = await firstValueFrom(this.http.get(url));
      return res.data?.data?.registration_nonce;
    } catch (err) {
      this.logger.error('Failed to fetch registration nonce', err?.response?.data ?? err.message);
      throw new InternalServerErrorException('Failed to fetch registration nonce');
    }
  }

  buildRegistrationMessage(brokerId: string, chainId: number, registrationNonce: string) {
    const timestamp = Date.now();
    // For Solana the message is a plain text block (Orderly expects platform-specific formatting).
    // We'll follow a conservative structured string approach:
    const message = [
      'Orderly registration',
      `brokerId:${brokerId}`,
      `chainId:${chainId}`,
      `timestamp:${timestamp}`,
      `registrationNonce:${registrationNonce}`,
    ].join('\n');
    return { message, timestamp };
  }

  // Sign message with a Solana private key (bech32 or base58 secretKey)
  signMessageWithSolana(secretKeyBase58: string, message: string) {
    try {
      const sk = bs58.decode(secretKeyBase58);
      // secretKey should be 64 bytes for Keypair (secretKey), or 32 bytes (seed)
      let secretKey = sk;
      if (sk.length === 32) {
        // expand seed to keypair
        const kp = nacl.sign.keyPair.fromSeed(sk);
        secretKey = kp.secretKey;
      } else if (sk.length === 64) {
        // assume it's full secretKey
        secretKey = sk;
      } else {
        throw new Error('Invalid Solana secret key length');
      }

      const sig = nacl.sign.detached(Buffer.from(message, 'utf8'), secretKey);
      return bs58.encode(sig);
    } catch (err) {
      this.logger.error('Failed to sign message with Solana key', err?.message ?? err);
      throw new BadRequestException('Failed to sign registration message');
    }
  }

  // High level register flow: decrypt user key, get nonce, sign, register on Orderly, and store account id
  async registerAccountForUser(walletAddress: string, brokerId = 'woofi_dex', chainId = 101) {
    // chainId: choose appropriate chain id for Solana per Orderly docs; default 101 (example)
    // 1. find user
    const user = await this.database.userWallet.findUnique({
      where: { walletAddress },
    });
    if (!user) throw new BadRequestException('User not found');

    // 2. decrypt solana private key (user.solanaEnPriKey expected to be base58-encoded secretKey)
    if (!user.solanaPriKey || !user.solanaPriKeyIv || !user.solanaPriKeyTag) {
      throw new BadRequestException('User Solana key not present');
    }

    let secretKeyStr: string;
    try {
      // decrypt returns utf8 string we used when encrypting (we stored base58 of secretKey)
      secretKeyStr = decrypt({
        iv: user.solanaPriKeyIv,
        data: user.solanaPriKey,
        tag: user.solanaPriKeyTag
      });
    } catch (err) {
      this.logger.error('Failed to decrypt user solana key', err?.message ?? err);
      throw new InternalServerErrorException('Failed to decrypt user key');
    }

    // 3. get nonce
    const registrationNonce = await this.getRegistrationNonce();
    if (!registrationNonce) throw new InternalServerErrorException('No registration nonce from Orderly');

    // 4. build message and sign with solana key
    const { message, timestamp } = this.buildRegistrationMessage(brokerId, chainId, registrationNonce);
    const signature = this.signMessageWithSolana(secretKeyStr, message);

    // 5. call register_account API
    const url = `${this.baseUrl}/v1/register_account`;
    try {
      const res = await firstValueFrom(this.http.post(url, {
        message,
        signature,
        userAddress: walletAddress,
      }, {
        headers: { 'Content-Type': 'application/json' }
      }));

      if (!res.data?.success) {
        this.logger.error('Orderly register_account failed', res.data);
        throw new InternalServerErrorException('Orderly registration failed');
      }

      const accountId = res.data?.data?.account_id;
      // 6. store orderly account id in user record
      await this.database.userWallet.update({
        where: { walletAddress },
        data: { orderlyAccountId: accountId },
      });

      return { accountId, timestamp, registrationNonce };
    } catch (err) {
      this.logger.error('Orderly register_account error', err?.response?.data ?? err?.message ?? err);
      throw new InternalServerErrorException('Orderly registration API error');
    }
  }

  async getAccountStatus(walletAddress: string) {
    const url = `${this.baseUrl}/v1/account_exists?userAddress=${walletAddress}`;
    try {
      const res = await firstValueFrom(this.http.get(url));
      return res.data;
    } catch (err) {
      this.logger.error('Failed to fetch Account status', err?.response?.data ?? err?.message);
      throw new InternalServerErrorException('Failed to fetch account status');
    }
  }
}