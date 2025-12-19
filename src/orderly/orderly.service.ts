import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import bs58 from 'bs58';
import nacl from 'tweetnacl';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from 'src/database/database.service';
import { decrypt } from 'src/utils/crypto.util';
import { Program, AnchorProvider, Idl } from '@project-serum/anchor';
import { PublicKey, SystemProgram } from '@solana/web3.js';
import vaultIdl from '../utils/idl/solana.vault.json';
import { SOLANA_VAULT, ORDERLY } from './orderly.constants';
import { SolanaClient } from '../utils/solana.client';
import { KeypairWallet } from '../utils/anchor.wallet';
import { keccak256, toUtf8Bytes } from 'ethers'; // not sure if this needed for solana but lets keep it for now
import { signOrderlyRequest } from './orderly.signer';
import {
  CreateOrderDto,
  EditOrderDto,
  GetOrdersDto,
  SettlePnlDto,
  InternalTransferHistoryDto,
  PositionHistoryQueryDto,
  GetAssetHistoryDto,
} from './dto/orderly-order.dto';
import {
  CreateAlgoOrderDto,
  EditAlgoOrderDto,
  GetAlgoOrdersDto,
} from './dto/orderly-algo-order.dto';

@Injectable()
export class OrderlyService {
  private readonly logger = new Logger(OrderlyService.name);
  private readonly baseUrl: string;
  private readonly brokerId: string;
  private readonly chaidId: Number;

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
    private readonly database: DatabaseService,
    private solana: SolanaClient,
  ) {
    this.baseUrl =
      this.config.get<string>('ORDERLY_BASE_URL') ??
      'https://testnet-api.orderly.org';
    this.brokerId = this.config.getOrThrow('ORDERLY_BROKER_ID');
    this.chaidId = this.config.getOrThrow('ORDERLY_CHAIN_ID');
  }

  async getRegistrationNonce() {
    const url = `${this.baseUrl}/v1/registration_nonce`;
    try {
      const res = await firstValueFrom(this.http.get(url));
      return res.data?.data?.registration_nonce;
    } catch (err) {
      this.logger.error(
        'Failed to fetch registration nonce',
        err?.response?.data ?? err.message,
      );
      throw new InternalServerErrorException(
        'Failed to fetch registration nonce',
      );
    }
  }

  buildRegistrationMessage(
    brokerId: string,
    chainId: number,
    registrationNonce: string,
  ) {
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
      this.logger.error(
        'Failed to sign message with Solana key',
        err?.message ?? err,
      );
      throw new BadRequestException('Failed to sign registration message');
    }
  }

  // High level register flow: decrypt user key, get nonce, sign, register on Orderly, and store account id
  async registerAccountForUser(
    walletAddress: string,
    brokerId = this.brokerId,
    chainId = this.chaidId,
  ) {
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
        tag: user.solanaPriKeyTag,
      });
    } catch (err) {
      this.logger.error(
        'Failed to decrypt user solana key',
        err?.message ?? err,
      );
      throw new InternalServerErrorException('Failed to decrypt user key');
    }

    // 3. get nonce
    const registrationNonce = await this.getRegistrationNonce();
    if (!registrationNonce)
      throw new InternalServerErrorException(
        'No registration nonce from Orderly',
      );

    // 4. build message and sign with solana key
    const { message, timestamp } = this.buildRegistrationMessage(
      brokerId,
      Number(chainId),
      registrationNonce,
    );
    const signature = this.signMessageWithSolana(secretKeyStr, message);

    // 5. call register_account API
    const url = `${this.baseUrl}/v1/register_account`;
    try {
      const res = await firstValueFrom(
        this.http.post(
          url,
          {
            message,
            signature,
            userAddress: walletAddress,
          },
          {
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      );

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
      this.logger.error(
        'Orderly register_account error',
        err?.response?.data ?? err?.message ?? err,
      );
      throw new InternalServerErrorException('Orderly registration API error');
    }
  }

  async getAccountStatus(walletAddress: string) {
    const url = `${this.baseUrl}/v1/account_exists?userAddress=${walletAddress}`;
    try {
      const res = await firstValueFrom(this.http.get(url));
      return res.data;
    } catch (err) {
      this.logger.error(
        'Failed to fetch Account status',
        err?.response?.data ?? err?.message,
      );
      throw new InternalServerErrorException('Failed to fetch account status');
    }
  }

  // deposit helper function to trigger orderly deposit
  // call this fn right after changeNow swap is successful.
  async depositSolForUser(params: {
    walletAddress: string;
    amountLamports: bigint;
    transactionId: string;
  }) {
    const user = await this.database.userWallet.findUnique({
      where: { walletAddress: params.walletAddress },
    });
    if (!user) throw new Error('User not found');

    if (!user.orderlyAccountId) {
      throw new Error('User not registered on Orderly');
    }

    await this.database.transaction.update({
      where: { id: params.transactionId },
      data: { status: 'ORDERLY_DEPOSIT_PENDING' },
    });

    // decrypt solana key
    const solSecretKey = decrypt({
      iv: user.solanaPriKeyIv!,
      data: user.solanaPriKey!,
      tag: user.solanaPriKeyTag!,
    });

    const txHash = await this.depositSol({
      userSecretKey: solSecretKey,
      orderlyAccountId: user.orderlyAccountId,
      amountLamports: params.amountLamports,
    });

    await this.database.transaction.update({
      where: { id: params.transactionId },
      data: {
        status: 'ORDERLY_DEPOSIT_CONFIRMED',
        TxHash: txHash,
        updatedAt: new Date()
      },
    });

    return txHash;
  }

  async depositSol({
    userSecretKey,
    orderlyAccountId,
    amountLamports,
  }: {
    userSecretKey: string;
    orderlyAccountId: string;
    amountLamports: bigint;
  }) {
    const user = this.solana.keypairFromBase58(userSecretKey);
    const wallet = new KeypairWallet(user);

    const provider = new AnchorProvider(this.solana.connection, wallet, {
      commitment: 'confirmed',
    });

    const program = new Program(
      vaultIdl as Idl,
      SOLANA_VAULT.PROGRAM_ID,
      provider,
    );

    const depositParams = {
      accountId: Buffer.from(orderlyAccountId.replace('0x', ''), 'hex'),
      brokerHash: Buffer.from(
        keccak256(toUtf8Bytes(this.brokerId)).slice(2),
        'hex',
      ),
      tokenHash: Buffer.from(keccak256(toUtf8Bytes('SOL')).slice(2), 'hex'),
      userAddress: user.publicKey.toBuffer(),
      tokenAmount: amountLamports,
    };

    const oappParams = {
      nativeFee: 0n,
      lzTokenFee: 0n,
    };

    return program.methods
      .depositSol(depositParams, oappParams)
      .accounts({
        user: user.publicKey,
        vaultAuthority: SOLANA_VAULT.VAULT_AUTHORITY,
        solVault: SOLANA_VAULT.SOL_VAULT,
        peer: SOLANA_VAULT.PEER,
        enforcedOptions: SOLANA_VAULT.ENFORCED_OPTIONS,
        oappConfig: SOLANA_VAULT.OAPP_CONFIG,
        allowedBroker: undefined,
        allowedToken: undefined,
        systemProgram: SystemProgram.programId,
      })
      .signers([user])
      .rpc();
  }

  async getWithdrawNonce(walletAddress: string) {
    const user = await this.database.userWallet.findUnique({
      where: { walletAddress },
    });
    if (!user?.orderlyAccountId) {
      throw new BadRequestException('Orderly account not registered');
    }

    // decrypt orderly secret key
    const secretKey = decrypt({
      iv: user.orderlyKeyIv!,
      data: user.orderlyKeySecret!,
      tag: user.orderlyKeyTag!,
    });

    const { headers } = await signOrderlyRequest({
      orderlyAccountId: user.orderlyAccountId!,
      orderlySecretKey: bs58.decode(secretKey),
      method: 'GET',
      path: '/v1/withdraw_nonce',
    });

    const res = await firstValueFrom(
      this.http.get(`${this.baseUrl}/v1/withdraw_nonce`, { headers }),
    );

    return res.data?.data?.withdraw_nonce;
  }

  async withdrawSol({
    walletAddress,
    amountLamports,
  }: {
    walletAddress: string;
    amountLamports: bigint;
  }) {
    const user = await this.database.userWallet.findUnique({
      where: { walletAddress },
    });
    if (!user?.orderlyAccountId) {
      throw new BadRequestException('Orderly account not registered');
    }

    // Create Tx FIRST
    const tx = await this.database.transaction.create({
      data: {
        userAddress: walletAddress,
        direction: 'WITHDRAW',
        status: 'ORDERLY_WITHDRAW_PENDING',
        fromCurrency: 'SOL',
        toCurrency: 'SOL',
        fromAmount: Number(amountLamports) / 1e9,
        toAmount: Number(amountLamports) / 1e9,
        fromNetwork: 'sol',
        toNetwork: 'sol',
        flow: 'standard',
        type: 'direct',
        payinAddress: '',
        payoutAddress: walletAddress,
        directedAmount: Number(amountLamports) / 1e9,
      },
    });

    // decrypt solana key
    const secretKey = decrypt({
      iv: user.solanaPriKeyIv,
      data: user.solanaPriKey,
      tag: user.solanaPriKeyTag,
    });

    // get withdraw nonce
    const withdrawNonce = await this.getWithdrawNonce(user.orderlyAccountId);

    const timestamp = Date.now().toString();

    // build withdraw message
    const message = {
      brokerId: this.brokerId,
      chainId: this.chaidId,
      receiver: user.solanaAddress,
      token: 'SOL',
      amount: amountLamports.toString(),
      withdrawNonce: withdrawNonce.toString(),
      timestamp,
      chainType: 'SOL',
      allowCrossChainWithdraw: true,
    };

    // sign message with Solana key
    const signature = this.signMessageWithSolana(
      secretKey,
      JSON.stringify(message),
    );

    // sign REST request
    const path = '/v1/withdraw_request';
    const body = JSON.stringify({
      signature,
      userAddress: user.solanaAddress,
      verifyingContract: SOLANA_VAULT.LEDGER,
      message,
    });

    // decrypt orderly secret key
    const orderlySecretKey = decrypt({
      iv: user.orderlyKeyIv!,
      data: user.orderlyKeySecret!,
      tag: user.orderlyKeyTag!,
    });

    const { headers } = await signOrderlyRequest({
      orderlyAccountId: user.orderlyAccountId!,
      orderlySecretKey: bs58.decode(orderlySecretKey),
      method: 'POST',
      path: path,
    });

    // submit withdraw request
    const res = await firstValueFrom(
      this.http.post(`${this.baseUrl}${path}`, JSON.parse(body), { headers }),
    );

    // Update Tx
    await this.database.transaction.update({
      where: { id: tx.id },
      data: {
        status: 'ORDERLY_WITHDRAW_CONFIRMED',
        orderlyTxId: res.data?.data?.withdraw_id,
      },
    });

    return res.data;
  }

  async createOrder(walletAddress: string, dto: CreateOrderDto) {
    const user = await this.database.userWallet.findUnique({
      where: { walletAddress },
    });
    if (!user) throw new BadRequestException('User not found');
    if (!user.orderlyAccountId)
      throw new BadRequestException('User not registered on Orderly');

    // --- Enforce Orderly rules ---
    if (dto.order_amount && dto.order_quantity) {
      throw new BadRequestException(
        'Provide either order_amount or order_quantity, not both',
      );
    }

    if (
      ['MARKET', 'ASK', 'BID'].includes(dto.order_type) &&
      dto.side === 'SELL' &&
      dto.order_amount
    ) {
      throw new BadRequestException(
        'SELL MARKET/ASK/BID must use order_quantity',
      );
    }

    if (
      ['MARKET', 'ASK', 'BID'].includes(dto.order_type) &&
      dto.side === 'BUY' &&
      dto.order_quantity
    ) {
      throw new BadRequestException('BUY MARKET/ASK/BID must use order_amount');
    }

    if (
      ['LIMIT', 'IOC', 'FOK', 'POST_ONLY'].includes(dto.order_type) &&
      dto.order_price === undefined
    ) {
      throw new BadRequestException(
        'order_price is required for this order type',
      );
    }

    // decrypt orderly private key
    const orderlyPriKey = decrypt({
      iv: user.orderlyKeyIv!,
      data: user.orderlyKeySecret!,
      tag: user.orderlyKeyTag!,
    });

    const path = '/v1/order';

    const { headers } = await signOrderlyRequest({
      orderlyAccountId: user.orderlyAccountId,
      orderlySecretKey: bs58.decode(orderlyPriKey),
      method: 'POST',
      path,
      body: dto,
    });

    const res = await firstValueFrom(
      this.http.post(`${this.baseUrl}${path}`, dto, {
        headers,
      }),
    );

    return res.data;
  }

  async createAlgoOrder(
    walletAddress: string,
    dto: CreateAlgoOrderDto | CreateAlgoOrderDto[],
  ) {
    const user = await this.database.userWallet.findUnique({
      where: { walletAddress },
    });
    if (!user) throw new BadRequestException('User not found');
    if (!user.orderlyAccountId)
      throw new BadRequestException('User not registered on Orderly');

    // 🔐 Decrypt Orderly private key
    const privateKeyHex = decrypt({
      iv: user.orderlyKeyIv!,
      data: user.orderlyKeySecret!,
      tag: user.orderlyKeyTag!,
    });

    // decrypt orderly secret key
    const orderlySecretKey = decrypt({
      iv: user.orderlyKeyIv!,
      data: user.orderlyKeySecret!,
      tag: user.orderlyKeyTag!,
    });

    const path = '/v1/algo/order';

    const { headers } = await signOrderlyRequest({
      orderlyAccountId: user.orderlyAccountId,
      orderlySecretKey: bs58.decode(orderlySecretKey),
      method: 'POST',
      path,
      body: dto,
    });

    try {
      const res = await firstValueFrom(
        this.http.post(`${this.baseUrl}${path}`, dto, {
          headers,
        }),
      );

      return res.data;
    } catch (err) {
      this.logger.error(
        'Algo order failed',
        err?.response?.data ?? err?.message,
      );
      throw new BadRequestException(
        err?.response?.data?.message ?? 'Algo order failed',
      );
    }
  }

  async editOrder(walletAddress: string, dto: EditOrderDto) {
    const user = await this.database.userWallet.findUnique({
      where: { walletAddress },
    });

    if (!user) throw new BadRequestException('User not found');
    if (!user.orderlyAccountId)
      throw new BadRequestException('User not registered on Orderly');

    // --- Orderly rule enforcement ---
    const editableFields =
      Number(dto.order_price !== undefined) +
      Number(dto.order_quantity !== undefined) +
      Number(dto.order_amount !== undefined);

    if (editableFields !== 1) {
      throw new BadRequestException(
        'Exactly ONE of order_price, order_quantity, or order_amount must be provided',
      );
    }

    // decrypt orderly private key
    const orderlyPriKey = decrypt({
      iv: user.orderlyKeyIv!,
      data: user.orderlyKeySecret!,
      tag: user.orderlyKeyTag!,
    });
    const path = '/v1/order';

    const { headers } = await signOrderlyRequest({
      orderlyAccountId: user.orderlyAccountId,
      orderlySecretKey: bs58.decode(orderlyPriKey),
      method: 'PUT',
      path,
      body: dto,
    });

    const res = await firstValueFrom(
      this.http.put(`${this.baseUrl}${path}`, dto, { headers }),
    );

    return res.data;
  }

  async editAlgoOrder(walletAddress: string, dto: EditAlgoOrderDto) {
    const user = await this.database.userWallet.findUnique({
      where: { walletAddress },
    });

    if (!user) throw new BadRequestException('User not found');
    if (!user.orderlyAccountId)
      throw new BadRequestException('User not registered on Orderly');

    // Must update at least ONE editable field
    if (
      dto.price === undefined &&
      dto.quantity === undefined &&
      dto.trigger_price === undefined &&
      !dto.child_orders
    ) {
      throw new BadRequestException(
        'At least one editable field must be provided',
      );
    }

    // decrypt orderly secret key
    const orderlySecretKey = decrypt({
      iv: user.orderlyKeyIv!,
      data: user.orderlyKeySecret!,
      tag: user.orderlyKeyTag!,
    });

    const path = '/v1/algo/order';

    const { headers } = await signOrderlyRequest({
      orderlyAccountId: user.orderlyAccountId,
      orderlySecretKey: bs58.decode(orderlySecretKey),
      method: 'PUT',
      path,
      body: dto,
    });

    const res = await firstValueFrom(
      this.http.put(`${this.baseUrl}${path}`, dto, {
        headers,
      }),
    );

    return res.data;
  }

  async cancelOrder(walletAddress: string, symbol: string, orderId: number) {
    const user = await this.database.userWallet.findUnique({
      where: { walletAddress },
    });

    if (!user) throw new BadRequestException('User not found');
    if (!user.orderlyAccountId)
      throw new BadRequestException('User not registered on Orderly');

    // decrypt orderly private key
    const orderlyPriKey = decrypt({
      iv: user.orderlyKeyIv!,
      data: user.orderlyKeySecret!,
      tag: user.orderlyKeyTag!,
    });

    // Build path with query params (IMPORTANT: included in signature)
    const path = `/v1/order?order_id=${orderId}&symbol=${encodeURIComponent(symbol)}`;
    // const path = `/v1/order?order_id=${orderId}&symbol=${symbol}`;

    const { headers } = await signOrderlyRequest({
      orderlyAccountId: user.orderlyAccountId,
      orderlySecretKey: bs58.decode(orderlyPriKey),
      method: 'DELETE',
      path,
    });

    const res = await firstValueFrom(
      this.http.delete(`${this.baseUrl}${path}`, {
        headers,
      }),
    );

    return res.data;
  }

  async cancelAlgoOrder(
    walletAddress: string,
    params: {
      orderId: number;
      symbol: string;
    },
  ) {
    const user = await this.database.userWallet.findUnique({
      where: { walletAddress },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (!user.orderlyAccountId) {
      throw new BadRequestException('User not registered on Orderly');
    }

    if (!params.orderId || !params.symbol) {
      throw new BadRequestException('orderId and symbol are required');
    }

    // decrypt orderly private key
    const orderlyPriKey = decrypt({
      iv: user.orderlyKeyIv!,
      data: user.orderlyKeySecret!,
      tag: user.orderlyKeyTag!,
    });

    const query = `?order_id=${params.orderId}&symbol=${encodeURIComponent(params.symbol)}`;
    // const query = `?order_id=${params.orderId}&symbol=${params.symbol}`;
    const path = `/v1/algo/order${query}`;

    const { headers } = await signOrderlyRequest({
      orderlyAccountId: user.orderlyAccountId,
      orderlySecretKey: bs58.decode(orderlyPriKey),
      method: 'DELETE',
      path,
    });

    const res = await firstValueFrom(
      this.http.delete(`${this.baseUrl}${path}`, {
        headers,
      }),
    );

    return res.data;
  }

  async cancelOrderByClientOrderId(
    walletAddress: string,
    clientOrderId: string,
    symbol: string,
  ) {
    const user = await this.database.userWallet.findUnique({
      where: { walletAddress },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (!user.orderlyAccountId) {
      throw new BadRequestException('User not registered on Orderly');
    }

    if (!user.orderlyKeySecret || !user.orderlyKeyIv || !user.orderlyKeyTag) {
      throw new BadRequestException('Orderly key not found');
    }

    // decrypt orderly private key
    const orderlyPriKey = decrypt({
      iv: user.orderlyKeyIv!,
      data: user.orderlyKeySecret!,
      tag: user.orderlyKeyTag!,
    });

    const path = `/v1/client/order`;
    const query = `?client_order_id=${clientOrderId}&symbol=${encodeURIComponent(symbol)}`;
    // const query = `?client_order_id=${clientOrderId}&symbol=${symbol}`;
    const fullPath = `${path}${query}`;

    // ✍️ Sign DELETE request (NO body)
    const { headers } = await signOrderlyRequest({
      orderlyAccountId: user.orderlyAccountId,
      orderlySecretKey: bs58.decode(orderlyPriKey),
      method: 'DELETE',
      path: fullPath,
    });

    const res = await firstValueFrom(
      this.http.delete(`${this.baseUrl}${fullPath}`, {
        headers,
      }),
    );

    return res.data;
  }

  async cancelAlgoOrderByClientId(
    walletAddress: string,
    symbol: string,
    clientOrderId: string,
  ) {
    const user = await this.database.userWallet.findUnique({
      where: { walletAddress },
    });

    if (!user) throw new BadRequestException('User not found');
    if (!user.orderlyAccountId) {
      throw new BadRequestException('User not registered on Orderly');
    }

    if (!symbol || !clientOrderId) {
      throw new BadRequestException('symbol and client_order_id are required');
    }

    // decrypt orderly private key
    const orderlyPriKey = decrypt({
      iv: user.orderlyKeyIv!,
      data: user.orderlyKeySecret!,
      tag: user.orderlyKeyTag!,
    });

    const query = `?client_order_id=${encodeURIComponent(clientOrderId)}&symbol=${encodeURIComponent(symbol)}`;
    const path = `/v1/algo/client/order${query}`;

    const { headers } = await signOrderlyRequest({
      orderlyAccountId: user.orderlyAccountId,
      orderlySecretKey: bs58.decode(orderlyPriKey),
      method: 'DELETE',
      path,
    });

    const res = await firstValueFrom(
      this.http.delete(`${this.baseUrl}${path}`, {
        headers,
      }),
    );

    return res.data;
  }

  async cancelAllAlgoOrders(
    walletAddress: string,
    params?: {
      symbol?: string;
      algo_type?: 'STOP' | 'TAKE_PROFIT' | 'STOP_LOSS';
    },
  ) {
    const user = await this.database.userWallet.findUnique({
      where: { walletAddress },
    });
    if (!user) throw new BadRequestException('User not found');
    if (!user.orderlyAccountId)
      throw new BadRequestException('User not registered on Orderly');

    // decrypt orderly private key
    const orderlyPriKey = decrypt({
      iv: user.orderlyKeyIv!,
      data: user.orderlyKeySecret!,
      tag: user.orderlyKeyTag!,
    });

    // build query string
    const qs = new URLSearchParams();
    if (params?.symbol) qs.append('symbol', params.symbol);
    if (params?.algo_type) qs.append('algo_type', params.algo_type);

    const path = `/v1/algo/orders${qs.toString() ? `?${qs.toString()}` : ''}`;

    const { headers } = await signOrderlyRequest({
      orderlyAccountId: user.orderlyAccountId,
      orderlySecretKey: bs58.decode(orderlyPriKey),
      method: 'DELETE',
      path,
    });

    const res = await firstValueFrom(
      this.http.delete(`${this.baseUrl}${path}`, { headers }),
    );

    return res.data;
  }

  async cancelAllOrders(walletAddress: string, symbol?: string) {
    const user = await this.database.userWallet.findUnique({
      where: { walletAddress },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (!user.orderlyAccountId) {
      throw new BadRequestException('User not registered on Orderly');
    }

    // decrypt orderly private key
    const orderlyPriKey = decrypt({
      iv: user.orderlyKeyIv!,
      data: user.orderlyKeySecret!,
      tag: user.orderlyKeyTag!,
    });

    const query = symbol ? `?symbol=${encodeURIComponent(symbol)}` : '';
    const path = `/v1/orders${query}`;

    const { headers } = await signOrderlyRequest({
      orderlyAccountId: user.orderlyAccountId,
      orderlySecretKey: bs58.decode(orderlyPriKey),
      method: 'DELETE',
      path,
    });

    const res = await firstValueFrom(
      this.http.delete(`${this.baseUrl}${path}`, {
        headers,
      }),
    );

    return res.data;
  }

  async cancelAllAfter(walletAddress: string, triggerAfter: number) {
    const user = await this.database.userWallet.findUnique({
      where: { walletAddress },
    });
    if (!user) throw new BadRequestException('User not found');
    if (!user.orderlyAccountId)
      throw new BadRequestException('User not registered on Orderly');

    if (triggerAfter !== 0 && triggerAfter < 5000) {
      throw new BadRequestException('Minimum trigger_after is 5000 ms');
    }

    // decrypt orderly private key
    const orderlyPriKey = decrypt({
      iv: user.orderlyKeyIv!,
      data: user.orderlyKeySecret!,
      tag: user.orderlyKeyTag!,
    });

    const path = '/v1/order/cancel_all_after';
    const body = { trigger_after: triggerAfter };

    const { headers } = await signOrderlyRequest({
      orderlyAccountId: user.orderlyAccountId,
      orderlySecretKey: bs58.decode(orderlyPriKey),
      method: 'POST',
      path,
      body,
    });

    const res = await firstValueFrom(
      this.http.post(`${this.baseUrl}${path}`, body, { headers }),
    );

    return res.data;
  }

  async getOrderById(walletAddress: string, orderId: string) {
    const user = await this.database.userWallet.findUnique({
      where: { walletAddress },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (!user.orderlyAccountId) {
      throw new BadRequestException('User not registered on Orderly');
    }

    // decrypt orderly private key
    const orderlyPriKey = decrypt({
      iv: user.orderlyKeyIv!,
      data: user.orderlyKeySecret!,
      tag: user.orderlyKeyTag!,
    });

    const path = `/v1/order/${orderId}`;

    const { headers } = await signOrderlyRequest({
      orderlyAccountId: user.orderlyAccountId,
      orderlySecretKey: bs58.decode(orderlyPriKey),
      method: 'GET',
      path,
    });

    try {
      const res = await firstValueFrom(
        this.http.get(`${this.baseUrl}${path}`, {
          headers,
        }),
      );

      return res.data;
    } catch (err) {
      this.logger.error(
        'Failed to fetch order by id',
        err?.response?.data ?? err?.message,
      );
      throw new InternalServerErrorException('Failed to fetch order');
    }
  }

  async getOrderByClientOrderId(walletAddress: string, clientOrderId: string) {
    const user = await this.database.userWallet.findUnique({
      where: { walletAddress },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (!user.orderlyAccountId) {
      throw new BadRequestException('User not registered on Orderly');
    }

    // decrypt orderly private key
    const orderlyPriKey = decrypt({
      iv: user.orderlyKeyIv!,
      data: user.orderlyKeySecret!,
      tag: user.orderlyKeyTag!,
    });

    const path = `/v1/client/order/${clientOrderId}`;

    // sign request per Orderly rules
    const { headers } = await signOrderlyRequest({
      orderlyAccountId: user.orderlyAccountId,
      orderlySecretKey: bs58.decode(orderlyPriKey),
      method: 'GET',
      path,
    });

    const res = await firstValueFrom(
      this.http.get(`${this.baseUrl}${path}`, {
        headers,
      }),
    );

    return res.data;
  }

  async getAlgoOrderById(walletAddress: string, orderId: string) {
    const user = await this.database.userWallet.findUnique({
      where: { walletAddress },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (!user.orderlyAccountId) {
      throw new BadRequestException('User not registered on Orderly');
    }

    // decrypt orderly private key
    const orderlyPriKey = decrypt({
      iv: user.orderlyKeyIv!,
      data: user.orderlyKeySecret!,
      tag: user.orderlyKeyTag!,
    });

    const path = `/v1/algo/order/${orderId}`;

    // sign GET request (NO body)
    const { headers } = await signOrderlyRequest({
      orderlyAccountId: user.orderlyAccountId,
      orderlySecretKey: bs58.decode(orderlyPriKey),
      method: 'GET',
      path,
    });

    const res = await firstValueFrom(
      this.http.get(`${this.baseUrl}${path}`, {
        headers,
      }),
    );

    return res.data;
  }

  async getAlgoOrderByClientOrderId(
    walletAddress: string,
    clientOrderId: string,
  ) {
    const user = await this.database.userWallet.findUnique({
      where: { walletAddress },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (!user.orderlyAccountId) {
      throw new BadRequestException('User not registered on Orderly');
    }

    // decrypt orderly private key
    const orderlyPriKey = decrypt({
      iv: user.orderlyKeyIv!,
      data: user.orderlyKeySecret!,
      tag: user.orderlyKeyTag!,
    });

    const path = `/v1/algo/client/order/${clientOrderId}`;

    // sign request
    const { headers } = await signOrderlyRequest({
      orderlyAccountId: user.orderlyAccountId,
      orderlySecretKey: bs58.decode(orderlyPriKey),
      method: 'GET',
      path,
    });

    const res = await firstValueFrom(
      this.http.get(`${this.baseUrl}${path}`, {
        headers,
      }),
    );

    return res.data;
  }

  async getOrders(walletAddress: string, query: GetOrdersDto) {
    const user = await this.database.userWallet.findUnique({
      where: { walletAddress },
    });
    if (!user) throw new BadRequestException('User not found');
    if (!user.orderlyAccountId) {
      throw new BadRequestException('User not registered on Orderly');
    }

    // decrypt orderly private key
    const orderlyPriKey = decrypt({
      iv: user.orderlyKeyIv!,
      data: user.orderlyKeySecret!,
      tag: user.orderlyKeyTag!,
    });

    // build query string
    const params = new URLSearchParams();
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== null) {
        params.append(k, String(v));
      }
    });

    const path = `/v1/orders${params.toString() ? `?${params.toString()}` : ''}`;

    const { headers } = await signOrderlyRequest({
      orderlyAccountId: user.orderlyAccountId,
      orderlySecretKey: bs58.decode(orderlyPriKey),
      method: 'GET',
      path,
    });

    const res = await firstValueFrom(
      this.http.get(`${this.baseUrl}${path}`, { headers }),
    );

    return res.data;
  }

  async getAlgoOrders(walletAddress: string, query: GetAlgoOrdersDto) {
    const user = await this.database.userWallet.findUnique({
      where: { walletAddress },
    });

    if (!user) throw new BadRequestException('User not found');
    if (!user.orderlyAccountId)
      throw new BadRequestException('User not registered on Orderly');

    // decrypt orderly private key
    const orderlyPriKey = decrypt({
      iv: user.orderlyKeyIv!,
      data: user.orderlyKeySecret!,
      tag: user.orderlyKeyTag!,
    });

    const params = new URLSearchParams();
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined) params.append(k, String(v));
    });

    const path = `/v1/algo/orders${params.toString() ? `?${params}` : ''}`;

    const { headers } = await signOrderlyRequest({
      orderlyAccountId: user.orderlyAccountId,
      orderlySecretKey: bs58.decode(orderlyPriKey),
      method: 'GET',
      path,
    });

    const res = await firstValueFrom(
      this.http.get(`${this.baseUrl}${path}`, {
        headers,
      }),
    );

    return res.data;
  }

  async getTrades(
    walletAddress: string,
    query: {
      symbol?: string;
      start_t?: number;
      end_t?: number;
      page?: number;
      size?: number;
    },
  ) {
    const user = await this.database.userWallet.findUnique({
      where: { walletAddress },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (!user.orderlyAccountId) {
      throw new BadRequestException('User not registered on Orderly');
    }

    // decrypt orderly private key
    const orderlyPriKey = decrypt({
      iv: user.orderlyKeyIv!,
      data: user.orderlyKeySecret!,
      tag: user.orderlyKeyTag!,
    });

    const path = '/v1/trades';

    // Build query string
    const params = new URLSearchParams();
    if (query.symbol) params.append('symbol', query.symbol);
    if (query.start_t) params.append('start_t', String(query.start_t));
    if (query.end_t) params.append('end_t', String(query.end_t));
    if (query.page) params.append('page', String(query.page));
    if (query.size) params.append('size', String(query.size));

    const fullPath = `${path}${params.toString() ? `?${params.toString()}` : ''}`;

    // Sign request
    const { headers } = await signOrderlyRequest({
      orderlyAccountId: user.orderlyAccountId,
      orderlySecretKey: bs58.decode(orderlyPriKey),
      method: 'GET',
      path: fullPath,
    });

    const res = await firstValueFrom(
      this.http.get(`${this.baseUrl}${fullPath}`, {
        headers,
      }),
    );

    return res.data;
  }

  async getTrade(walletAddress: string, tradeId: number) {
    const user = await this.database.userWallet.findUnique({
      where: { walletAddress },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (!user.orderlyAccountId) {
      throw new BadRequestException('User not registered on Orderly');
    }

    // decrypt orderly private key
    const orderlyPriKey = decrypt({
      iv: user.orderlyKeyIv!,
      data: user.orderlyKeySecret!,
      tag: user.orderlyKeyTag!,
    });

    const path = `/v1/trade/${tradeId}`;

    // ✍️ Sign GET request (NO body)
    const { headers } = await signOrderlyRequest({
      orderlyAccountId: user.orderlyAccountId,
      orderlySecretKey: bs58.decode(orderlyPriKey),
      method: 'GET',
      path,
    });

    try {
      const res = await firstValueFrom(
        this.http.get(`${this.baseUrl}${path}`, { headers }),
      );

      return res.data;
    } catch (err) {
      this.logger.error(
        'Failed to fetch trade',
        err?.response?.data ?? err?.message,
      );
      throw new InternalServerErrorException('Failed to fetch trade');
    }
  }

  async getOrderTrades(walletAddress: string, orderId: number) {
    const user = await this.database.userWallet.findUnique({
      where: { walletAddress },
    });
    if (!user) throw new BadRequestException('User not found');
    if (!user.orderlyAccountId) {
      throw new BadRequestException('User not registered on Orderly');
    }

    // decrypt orderly private key
    const orderlyPriKey = decrypt({
      iv: user.orderlyKeyIv!,
      data: user.orderlyKeySecret!,
      tag: user.orderlyKeyTag!,
    });

    const path = `/v1/order/${orderId}/trades`;

    const { headers } = await signOrderlyRequest({
      orderlyAccountId: user.orderlyAccountId,
      orderlySecretKey: bs58.decode(orderlyPriKey),
      method: 'GET',
      path,
    });

    try {
      const res = await firstValueFrom(
        this.http.get(`${this.baseUrl}${path}`, { headers }),
      );
      return res.data;
    } catch (err) {
      this.logger.error(
        `Failed to fetch trades for order ${orderId}`,
        err?.response?.data ?? err?.message,
      );
      throw new InternalServerErrorException(
        'Failed to fetch order trades from Orderly',
      );
    }
  }

  async getAlgoOrderTrades(walletAddress: string, orderId: number) {
    const user = await this.database.userWallet.findUnique({
      where: { walletAddress },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (!user.orderlyAccountId) {
      throw new BadRequestException('User not registered on Orderly');
    }

    // decrypt orderly private key
    const orderlyPriKey = decrypt({
      iv: user.orderlyKeyIv!,
      data: user.orderlyKeySecret!,
      tag: user.orderlyKeyTag!,
    });

    const path = `/v1/algo/order/${orderId}/trades`;

    const { headers } = await signOrderlyRequest({
      orderlyAccountId: user.orderlyAccountId,
      orderlySecretKey: bs58.decode(orderlyPriKey),
      method: 'GET',
      path,
    });

    const res = await firstValueFrom(
      this.http.get(`${this.baseUrl}${path}`, {
        headers,
      }),
    );

    return res.data;
  }

  async getCurrentHolding(walletAddress: string, all: boolean = false) {
    const user = await this.database.userWallet.findUnique({
      where: { walletAddress },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (!user.orderlyAccountId) {
      throw new BadRequestException('User not registered on Orderly');
    }

    // decrypt orderly private key
    const orderlyPriKey = decrypt({
      iv: user.orderlyKeyIv!,
      data: user.orderlyKeySecret!,
      tag: user.orderlyKeyTag!,
    });

    const path = `/v1/client/holding${all ? '?all=true' : ''}`;

    // 🔏 Sign request (GET, no body)
    const { headers } = await signOrderlyRequest({
      orderlyAccountId: user.orderlyAccountId,
      orderlySecretKey: bs58.decode(orderlyPriKey),
      method: 'GET',
      path,
    });

    const res = await firstValueFrom(
      this.http.get(`${this.baseUrl}${path}`, {
        headers,
      }),
    );

    return res.data;
  }

  async getSettleNonce(walletAddress: string) {
    const user = await this.database.userWallet.findUnique({
      where: { walletAddress },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (!user.orderlyAccountId) {
      throw new BadRequestException('User not registered on Orderly');
    }

    // decrypt orderly private key
    const orderlyPriKey = decrypt({
      iv: user.orderlyKeyIv!,
      data: user.orderlyKeySecret!,
      tag: user.orderlyKeyTag!,
    });

    const path = '/v1/settle_nonce';

    // sign request (GET, no body)
    const { headers } = await signOrderlyRequest({
      orderlyAccountId: user.orderlyAccountId,
      orderlySecretKey: bs58.decode(orderlyPriKey),
      method: 'GET',
      path,
    });

    try {
      const res = await firstValueFrom(
        this.http.get(`${this.baseUrl}${path}`, {
          headers,
        }),
      );

      return res.data?.data;
    } catch (err) {
      this.logger.error(
        'Failed to fetch settle nonce',
        err?.response?.data ?? err?.message ?? err,
      );
      throw new InternalServerErrorException('Failed to fetch settle nonce');
    }
  }

  async settlePnl(walletAddress: string, dto: SettlePnlDto) {
    const user = await this.database.userWallet.findUnique({
      where: { walletAddress },
    });

    if (!user) throw new BadRequestException('User not found');
    if (!user.orderlyAccountId) {
      throw new BadRequestException('User not registered on Orderly');
    }

    // get settlePnL nonce
    const settlePnLNonce = await this.getSettleNonce(walletAddress);

    // decrypt orderly private key
    const orderlyPriKey = decrypt({
      iv: user.orderlyKeyIv!,
      data: user.orderlyKeySecret!,
      tag: user.orderlyKeyTag!,
    });

    const path = '/v1/settle_pnl';

    const message = {
      brokerId: this.brokerId,
      chainId: this.chaidId,
      settleNonce: settlePnLNonce?.settle_nonce!,
      timestamp: Date.now(),
      chainType: ORDERLY.CHAIN_TYPE,
    };

    const body = {
      signature: dto.signature,
      userAddress: dto.userAddress,
      verifyingContract: SOLANA_VAULT.LEDGER,
      message,
    };

    const { headers } = await signOrderlyRequest({
      orderlyAccountId: user.orderlyAccountId,
      orderlySecretKey: bs58.decode(orderlyPriKey),
      method: 'POST',
      path,
      body,
    });

    const res = await firstValueFrom(
      this.http.post(`${this.baseUrl}${path}`, body, { headers }),
    );

    return res.data;
  }

  async getPnlSettlementHistory(
    walletAddress: string,
    query: {
      start_t?: number;
      end_t?: number;
      page?: number;
      size?: number;
    },
  ) {
    const user = await this.database.userWallet.findUnique({
      where: { walletAddress },
    });
    if (!user) throw new BadRequestException('User not found');
    if (!user.orderlyAccountId)
      throw new BadRequestException('User not registered on Orderly');

    // decrypt orderly private key
    const orderlyPriKey = decrypt({
      iv: user.orderlyKeyIv!,
      data: user.orderlyKeySecret!,
      tag: user.orderlyKeyTag!,
    });

    const params = new URLSearchParams();
    if (query.start_t) params.append('start_t', String(query.start_t));
    if (query.end_t) params.append('end_t', String(query.end_t));
    if (query.page) params.append('page', String(query.page));
    if (query.size) params.append('size', String(query.size));

    const path = `/v1/pnl_settlement/history${params.toString() ? `?${params}` : ''}`;

    // sign request
    const { headers } = await signOrderlyRequest({
      orderlyAccountId: user.orderlyAccountId,
      orderlySecretKey: bs58.decode(orderlyPriKey),
      method: 'GET',
      path,
    });

    try {
      const res = await firstValueFrom(
        this.http.get(`${this.baseUrl}${path}`, { headers }),
      );
      return res.data;
    } catch (err) {
      this.logger.error(
        'Failed to fetch PnL settlement history',
        err?.response?.data ?? err?.message,
      );
      throw new InternalServerErrorException(
        'Failed to fetch PnL settlement history',
      );
    }
  }

  async getTransferNonce(walletAddress: string) {
    const user = await this.database.userWallet.findUnique({
      where: { walletAddress },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (!user.orderlyAccountId) {
      throw new BadRequestException('User is not registered on Orderly');
    }

    if (!user.orderlyKeySecret || !user.orderlyKeyIv || !user.orderlyKeyTag) {
      throw new BadRequestException('Orderly signing key missing');
    }

    // decrypt orderly private key
    const orderlyPriKey = decrypt({
      iv: user.orderlyKeyIv!,
      data: user.orderlyKeySecret!,
      tag: user.orderlyKeyTag!,
    });

    const path = '/v1/transfer_nonce';

    // Sign request
    const { headers } = await signOrderlyRequest({
      orderlyAccountId: user.orderlyAccountId,
      orderlySecretKey: bs58.decode(orderlyPriKey),
      method: 'GET',
      path,
    });

    // Call Orderly
    const res = await firstValueFrom(
      this.http.get(`${this.baseUrl}${path}`, {
        headers,
      }),
    );

    if (!res.data?.success) {
      this.logger.error('Failed to get transfer nonce', res.data);
      throw new InternalServerErrorException('Failed to fetch transfer nonce');
    }

    return res.data.data; // { transfer_nonce: number }
  }

  async createInternalTransfer({
    walletAddress,
    token = 'SOL',
    amount,
    chainId = this.chaidId,
  }: {
    walletAddress: string;
    token?: string;
    amount: bigint;
    chainId?: Number;
  }) {
    // 1️⃣ Load user
    const user = await this.database.userWallet.findUnique({
      where: { walletAddress },
    });

    if (!user || !user.orderlyAccountId) {
      throw new BadRequestException('User not registered on Orderly');
    }

    // decrypt orderly private key
    const orderlyPriKey = decrypt({
      iv: user.orderlyKeyIv!,
      data: user.orderlyKeySecret!,
      tag: user.orderlyKeyTag!,
    });

    // Decrypt Solana secret key (for wallet signature)
    const solSecretKeyBase58 = decrypt({
      iv: user.solanaPriKeyIv,
      data: user.solanaPriKey,
      tag: user.solanaPriKeyTag,
    });

    // Get transfer nonce
    const { transfer_nonce } = await this.getTransferNonce(walletAddress);

    // Build message
    const message = {
      receiver: walletAddress,
      token,
      amount: amount.toString(),
      transferNonce: String(transfer_nonce),
      chainId: String(chainId),
      chainType: 'SOL' as const,
    };

    // sign message with Solana key
    const signature = this.signMessageWithSolana(
      solSecretKeyBase58,
      JSON.stringify(message),
    );

    // Sign API request (Orderly signature)
    const path = '/v2/internal_transfer';

    const { headers } = await signOrderlyRequest({
      orderlyAccountId: user.orderlyAccountId,
      orderlySecretKey: bs58.decode(orderlyPriKey),
      method: 'POST',
      path,
      body: JSON.stringify({
        signature: signature,
        userAddress: user.solanaAddress,
        verifyingContract: SOLANA_VAULT.LEDGER,
        message,
      }),
    });

    // Send request
    const res = await firstValueFrom(
      this.http.post(
        `${this.baseUrl}${path}`,
        {
          signature: signature,
          userAddress: user.solanaAddress,
          verifyingContract: SOLANA_VAULT.LEDGER,
          message,
        },
        { headers },
      ),
    );

    if (!res.data?.success) {
      this.logger.error('Internal transfer failed', res.data);
      throw new InternalServerErrorException('Internal transfer failed');
    }

    return res.data.data; // { internal_transfer_request_id }
  }

  async getInternalTransferHistory(
    walletAddress: string,
    query: InternalTransferHistoryDto,
  ) {
    const user = await this.database.userWallet.findUnique({
      where: { walletAddress },
    });
    if (!user) throw new BadRequestException('User not found');
    if (!user.orderlyAccountId) {
      throw new BadRequestException('User not registered on Orderly');
    }

    // decrypt orderly secret key
    const orderlySecretKey = decrypt({
      iv: user.orderlyKeyIv!,
      data: user.orderlyKeySecret!,
      tag: user.orderlyKeyTag!,
    });

    const path = '/v1/internal_transfer_history';

    // build query string
    const urlParams = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined) {
        urlParams.append(key, String(value));
      }
    });

    const fullPath = `${path}?${urlParams.toString()}`;

    const { headers } = await signOrderlyRequest({
      orderlyAccountId: user.orderlyAccountId,
      orderlySecretKey: bs58.decode(orderlySecretKey),
      method: 'GET',
      path: fullPath,
    });

    const res = await firstValueFrom(
      this.http.get(`${this.baseUrl}${fullPath}`, {
        headers,
      }),
    );

    return res.data;
  }

  async getPositions(walletAddress: string) {
    const user = await this.database.userWallet.findUnique({
      where: { walletAddress },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (!user.orderlyAccountId) {
      throw new BadRequestException('User not registered on Orderly');
    }

    // decrypt orderly secret key
    const orderlySecretKey = decrypt({
      iv: user.orderlyKeyIv!,
      data: user.orderlyKeySecret!,
      tag: user.orderlyKeyTag!,
    });

    const path = '/v1/positions';

    // Sign GET request (NO BODY)
    const { headers } = await signOrderlyRequest({
      orderlyAccountId: user.orderlyAccountId,
      orderlySecretKey: bs58.decode(orderlySecretKey),
      method: 'GET',
      path,
    });

    try {
      const res = await firstValueFrom(
        this.http.get(`${this.baseUrl}${path}`, {
          headers,
        }),
      );

      return res.data;
    } catch (err) {
      this.logger.error(
        'Failed to fetch positions',
        err?.response?.data ?? err?.message,
      );
      throw new InternalServerErrorException('Failed to fetch positions');
    }
  }
  async getPosition(walletAddress: string, symbol: string) {
    const user = await this.database.userWallet.findUnique({
      where: { walletAddress },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (!user.orderlyAccountId) {
      throw new BadRequestException('User not registered on Orderly');
    }

    // decrypt orderly secret key
    const orderlySecretKey = decrypt({
      iv: user.orderlyKeyIv!,
      data: user.orderlyKeySecret!,
      tag: user.orderlyKeyTag!,
    });

    const path = `/v1/position/${symbol}`;

    const { headers } = await signOrderlyRequest({
      orderlyAccountId: user.orderlyAccountId,
      orderlySecretKey: bs58.decode(orderlySecretKey),
      method: 'GET',
      path,
    });

    const res = await firstValueFrom(
      this.http.get(`${this.baseUrl}${path}`, {
        headers,
      }),
    );

    return res.data;
  }

  async getPositionHistory(
    walletAddress: string,
    query: PositionHistoryQueryDto,
  ) {
    const user = await this.database.userWallet.findUnique({
      where: { walletAddress },
    });

    if (!user) throw new BadRequestException('User not found');
    if (!user.orderlyAccountId)
      throw new BadRequestException('User not registered on Orderly');

    // decrypt orderly secret key
    const orderlySecretKey = decrypt({
      iv: user.orderlyKeyIv!,
      data: user.orderlyKeySecret!,
      tag: user.orderlyKeyTag!,
    });

    // build query string
    const params = new URLSearchParams();
    if (query.symbol) params.append('symbol', query.symbol);
    if (query.limit) params.append('limit', query.limit.toString());

    const path = `/v1/position_history${params.toString() ? `?${params}` : ''}`;

    const { headers } = await signOrderlyRequest({
      orderlyAccountId: user.orderlyAccountId,
      orderlySecretKey: bs58.decode(orderlySecretKey),
      method: 'GET',
      path,
    });

    const res = await firstValueFrom(
      this.http.get(`${this.baseUrl}${path}`, { headers }),
    );

    return res.data;
  }

  async getAssetHistory(walletAddress: string, query: GetAssetHistoryDto) {
    const user = await this.database.userWallet.findUnique({
      where: { walletAddress },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (!user.orderlyAccountId) {
      throw new BadRequestException('User not registered on Orderly');
    }

    // Build query string
    const params = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, String(value));
      }
    });

    const path = `/v1/asset/history${params.toString() ? `?${params}` : ''}`;

    // decrypt orderly secret key
    const orderlySecretKey = decrypt({
      iv: user.orderlyKeyIv!,
      data: user.orderlyKeySecret!,
      tag: user.orderlyKeyTag!,
    });

    const { headers } = await signOrderlyRequest({
      orderlyAccountId: user.orderlyAccountId,
      orderlySecretKey: bs58.decode(orderlySecretKey),
      method: 'GET',
      path,
    });

    const res = await firstValueFrom(
      this.http.get(`${this.baseUrl}${path}`, {
        headers,
      }),
    );

    return res.data;
  }
}
