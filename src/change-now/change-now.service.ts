import { Injectable, HttpException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { ChangeNowExchangeDto } from './dto/exchange-request.dto';
import { DatabaseService } from 'src/database/database.service';
import { decrypt } from 'src/utils/crypto.util';
import { CardanoService } from 'src/cardano/cardano.service';
import { SolanaClient } from '../utils/solana.client';
import { KeypairWallet } from '../utils/anchor.wallet';
import { AnchorProvider } from '@project-serum/anchor';
import {
  SystemProgram,
  Transaction,
  PublicKey,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';

@Injectable()
export class ChangeNowService {
  private readonly apiUrl = process.env.CHANGENOW_API_URL!;
  private readonly apiKey = process.env.CHANGENOW_API_KEY!;

  constructor(
    private readonly httpService: HttpService,
    private readonly databaseService: DatabaseService,
    private cardanoService: CardanoService,
    private solana: SolanaClient,
  ) {}

  async getMinAmount(params: {
    fromCurrency: string;
    toCurrency: string;
    fromNetwork: string;
    toNetwork: string;
    flow?: string;
  }) {
    const {
      fromCurrency,
      toCurrency,
      fromNetwork,
      toNetwork,
      flow = 'standard',
    } = params;

    const url = `${this.apiUrl}/exchange/min-amount`;

    try {
      const response = await firstValueFrom(
        this.httpService.get(url, {
          params: {
            fromCurrency,
            toCurrency,
            fromNetwork,
            toNetwork,
            flow,
          },
        }),
      );

      return response.data;
    } catch (error) {
      throw new HttpException(
        error?.response?.data || 'Failed to fetch min amount',
        error?.response?.status || 500,
      );
    }
  }

  // Create an Exchange Request
  // When this function invoke, we need to create
  // an exchange transaction and execute it right away
  // and return TxId.
  async createExchange(body: ChangeNowExchangeDto) {
    const url = `${this.apiUrl}/exchange`;

    try {
      const response = await firstValueFrom(
        this.httpService.post(url, body, {
          headers: {
            'Content-Type': 'application/json',
            'x-changenow-api-key': this.apiKey,
          },
        }),
      );

      return response.data;
    } catch (error) {
      throw new HttpException(
        error?.response?.data || 'Failed to create exchange transaction',
        error?.response?.status || 500,
      );
    }
  }

  async createExchangeAndSend(
    reqUserAddress: string,
    dto: ChangeNowExchangeDto,
  ) {
    // Call ChangeNow
    const changeNowResponse = await this.createExchange(dto);

    // Save Transaction
    const transaction = await this.databaseService.transaction.create({
      data: {
        fromAmount: changeNowResponse.fromAmount,
        toAmount: changeNowResponse.toAmount,
        flow: changeNowResponse.flow,
        type: changeNowResponse.type,
        direction: 'DEPOSIT',
        payinAddress: changeNowResponse.payinAddress,
        payoutAddress: changeNowResponse.payoutAddress,
        fromCurrency: changeNowResponse.fromCurrency,
        toCurrency: changeNowResponse.toCurrency,
        directedAmount: changeNowResponse.directedAmount,
        fromNetwork: changeNowResponse.fromNetwork,
        toNetwork: changeNowResponse.toNetwork,
        exchangeId: changeNowResponse.id,
        userAddress: reqUserAddress,
        status: 'CHANGENOW_CREATED',
      },
    });

    // Fetch user wallet
    const userWallet = await this.databaseService.userWallet.findUnique({
      where: { walletAddress: reqUserAddress },
    });

    if (!userWallet) throw new Error('Wallet not found');

    // Decrypt Cardano private key
    const cardanoWalletMnemonic = decrypt({
      iv: userWallet.cardanoPriKeyIv,
      data: userWallet.cardanoPriKey,
      tag: userWallet.cardanoPriKeyTag,
    });

    const words = cardanoWalletMnemonic.trim().split(/\s+/);

    // Build + send Cardano transaction
    const txHash = await this.cardanoService.sendTransaction(
      words,
      changeNowResponse.payinAddress,
      Math.floor(changeNowResponse.fromAmount * 1_000_000).toString(), // ADA → Lovelace
    );

    // Update transaction status
    await this.databaseService.transaction.update({
      where: { id: transaction.id },
      data: {
        status: 'CHANGENOW_EXCHANGING',
        refundHash: txHash.txHash,
      },
    });

    return {
      status: 'success',
      exchangeId: transaction.exchangeId,
      blockchainTx: txHash,
    };
  }

  async swapSolToAdaAndSendToUser(
    // reqUserAddress: string,
    // solAmount: string, // in SOL (not lamports)
    transactionId: string,
  ) {
    const tx = await this.databaseService.transaction.findUnique({
      where: { id: transactionId },
      include: { user: true },
    });

    if (!tx || tx.direction !== 'WITHDRAW') {
      throw new Error('Invalid withdrawal transaction');
    }

    if (tx.status !== 'ORDERLY_WITHDRAW_CONFIRMED') {
      return; // idempotent exit
    }

    const user = tx.user;

    if (!user) {
      throw new Error('User not found');
    }

    // Create ChangeNow exchange SOL → ADA
    const changeNowResponse = await this.createExchange({
      fromCurrency: 'sol',
      toCurrency: 'ada',
      fromNetwork: 'sol',
      toNetwork: 'ada',
      fromAmount: String(tx.fromAmount),
      address: user.walletAddress, // direct to user
      flow: 'standard',
    });

    // Update Tx
    const updatedTx = await this.databaseService.transaction.update({
      where: { id: tx.id },
      data: {
        fromAmount: changeNowResponse.fromAmount,
        toAmount: changeNowResponse.toAmount,
        flow: changeNowResponse.flow,
        type: changeNowResponse.type,
        direction: 'WITHDRAW',
        payinAddress: changeNowResponse.payinAddress,
        payoutAddress: changeNowResponse.payoutAddress,
        fromCurrency: changeNowResponse.fromCurrency,
        toCurrency: changeNowResponse.toCurrency,
        directedAmount: changeNowResponse.directedAmount,
        fromNetwork: changeNowResponse.fromNetwork,
        toNetwork: changeNowResponse.toNetwork,
        exchangeId: changeNowResponse.id,
        userAddress: tx.userAddress,
      },
    });

    //
    // send sol changeNow payin addr
    //
    // Decrypt solana private key
    const solanaPrivKey = decrypt({
      iv: user.solanaPriKeyIv,
      data: user.solanaPriKey,
      tag: user.solanaPriKeyTag,
    });

    const keypair = this.solana.keypairFromBase58(solanaPrivKey);
    const wallet = new KeypairWallet(keypair);

    const provider = new AnchorProvider(this.solana.connection, wallet, {
      commitment: 'confirmed',
    });

    const lamports = Math.floor(Number(updatedTx.toAmount) * LAMPORTS_PER_SOL);

    const txSol = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: keypair.publicKey,
        toPubkey: new PublicKey(changeNowResponse.payinAddress),
        lamports,
      }),
    );

    const signature = await provider.sendAndConfirm(txSol);

    // Update tx status → swap started
    await this.databaseService.transaction.update({
      where: { id: tx.id },
      data: {
        status: 'CHANGENOW_EXCHANGING',
        refundHash: signature, // reuse column for chain tx hash
      },
    });

    return {
      status: 'success',
      exchangeId: updatedTx.exchangeId,
      blockchainTx: signature,
    };
  }
}
