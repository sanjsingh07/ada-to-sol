import { Injectable, HttpException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { ChangeNowExchangeDto } from './dto/exchange-request.dto';
import { DatabaseService } from 'src/database/database.service';
import { decrypt } from "src/utils/crypto.util";
import { CardanoService } from 'src/cardano/cardano.service';


@Injectable()
export class ChangeNowService {

  private readonly apiUrl = process.env.CHANGENOW_API_URL!;
  private readonly apiKey = process.env.CHANGENOW_API_KEY!;

  constructor(private readonly httpService: HttpService, private readonly databaseService: DatabaseService, private cardanoService: CardanoService) {}

  async getMinAmount(params: {
    fromCurrency: string;
    toCurrency: string;
    fromNetwork: string;
    toNetwork: string;
    flow?: string;
  }) {
    const { fromCurrency, toCurrency, fromNetwork, toNetwork, flow = 'standard' } = params;

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



  async createExchangeAndSend(reqUserAddress: string, dto: ChangeNowExchangeDto) {
  // 1. Call ChangeNow
  const changeNowResponse = await this.createExchange(dto);

  // 2. Save Transaction
  const transaction = await this.databaseService.transaction.create({
    data: {
      ...changeNowResponse,
      exchangeId: changeNowResponse.id,
      userAddress: reqUserAddress,
    },
  });

  // 3. Fetch user wallet
  const userWallet = await this.databaseService.userWallet.findUnique({
    where: { walletAddress: reqUserAddress },
  });

  if (!userWallet) throw new Error('Wallet not found');

  // 4. Decrypt Cardano private key
  const cardanoPrivateKey = decrypt({
    iv: userWallet.cardanoPriKeyIv,
    data: userWallet.cardanoPriKey,
    tag: userWallet.cardanoPriKeyTag,
  });

  // 5. Build + send Cardano transaction
  const txHash = await this.cardanoService.sendTransaction(
    cardanoPrivateKey, 
    changeNowResponse.payinAddress,
    Math.floor(changeNowResponse.fromAmount * 1_000_000).toString(), // ADA → Lovelace
  );

  // 6. Update transaction status
  await this.databaseService.transaction.update({
    where: { id: transaction.id },
    data: {
      status: 'SENDING',
      refundHash: txHash.txHash,
    },
  });

  return {
    status: 'success',
    exchangeId: transaction.exchangeId,
    blockchainTx: txHash,
  };
}


}
