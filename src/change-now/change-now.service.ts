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


  // Test function
  // REMOVE THIS PART OF CODE WHEN DONE TESTING ON MAINNET
  // async sendTransaction(reqUserAddress: string) {
    
  //   const userWallet = await this.databaseService.userWallet.findUnique({
  //     where: { walletAddress: reqUserAddress },
  //   });

  //   console.log("printing userWallet: ",userWallet);

  // if (!userWallet) throw new Error('Wallet not found');

  //   // 4. Decrypt Cardano private key
  //   const cardanoPrivateKey = decrypt({
  //     iv: userWallet.cardanoPriKeyIv,
  //     data: userWallet.cardanoPriKey,
  //     tag: userWallet.cardanoPriKeyTag,
  //   });

  //   console.log("printing cardanoPrivateKey: ",cardanoPrivateKey);

  //   // 5. Build + send Cardano transaction
  //   const txHash = await this.cardanoService.sendTransaction(
  //     cardanoPrivateKey, 
  //     "addr_test1qqelrke3nl7czzsvw0jhw46ak7kvve7dvt0rcnq4a20gj52x5yex2q0dtufmht9xtvdmvzf4jw5xp3zg5avg5lxg9t8sn2d00s",
  //     Math.floor(1 * 1_000_000).toString(), // ADA → Lovelace
  //   );

  //   return {
  //     status: 'success',
  //     // exchangeId: transaction.exchangeId,
  //     blockchainTx: txHash,
  //   };

  // }


  async createExchangeAndSend(reqUserAddress: string, dto: ChangeNowExchangeDto) {
  // 1. Call ChangeNow
  const changeNowResponse = await this.createExchange(dto);

  // 2. Save Transaction
  const transaction = await this.databaseService.transaction.create({
    data: {
      fromAmount: changeNowResponse.fromAmount,
      toAmount: changeNowResponse.toAmount,
      flow: changeNowResponse.flow,
      type: changeNowResponse.type,
      payinAddress: changeNowResponse.payinAddress,
      payoutAddress: changeNowResponse.payoutAddress,
      fromCurrency: changeNowResponse.fromCurrency,
      toCurrency: changeNowResponse.toCurrency,
      directedAmount: changeNowResponse.directedAmount,
      fromNetwork: changeNowResponse.fromNetwork,
      toNetwork: changeNowResponse.toNetwork,
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
  const cardanoWalletMnemonic = decrypt({
    iv: userWallet.cardanoPriKeyIv,
    data: userWallet.cardanoPriKey,
    tag: userWallet.cardanoPriKeyTag,
  });

  const words = cardanoWalletMnemonic.trim().split(/\s+/);

  // 5. Build + send Cardano transaction
  const txHash = await this.cardanoService.sendTransaction(
    words, 
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
