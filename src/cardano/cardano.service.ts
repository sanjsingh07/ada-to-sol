import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BlockfrostProvider,
  MeshTxBuilder,
  MeshWallet,
  Asset,
} from '@meshsdk/core';
import { CardanoConfig } from '../config/cardano.config';

@Injectable()
export class CardanoService {
  private readonly logger = new Logger(CardanoService.name);
  private provider: BlockfrostProvider;
  private meshTxBuilder: MeshTxBuilder;

  constructor(private configService: ConfigService) {
    // const config = this.configService.get<CardanoConfig>('cardano');
    const config = this.configService.getOrThrow<CardanoConfig>('cardano');
    
    this.provider = new BlockfrostProvider(config.blockfrostApiKey);

    this.meshTxBuilder = new MeshTxBuilder({
      fetcher: this.provider,
      submitter: this.provider,
      verbose: true,
    });
  }

  /**
   * Send ADA to a recipient address
   * @param senderPrivkey - PrivKey of sender
   * @param recipientAddress - Bech32 address of recipient
   * @param amount - Amount in lovelace (1 ADA = 1,000,000 lovelace)
   */
  async sendTransaction(
    mnemonic: string[],
    recipientAddress: string,
    amount: string,
  ): Promise<{ txHash: string }> {
    try {
      // Initialize wallet from mnemonic
      const wallet = new MeshWallet({
        networkId: 0, // 0 for testnet, 1 for mainnet
        fetcher: this.provider,
        submitter: this.provider,
        key: {
          type: 'mnemonic',
          words: mnemonic,
        },
      });

      // TEST WALLET Configration
      // const wallet = new MeshWallet({
      //   networkId: 0, // 0 for testnet, 1 for mainnet
      //   fetcher: this.provider,
      //   submitter: this.provider,
      //   key: {
      //     type: 'mnemonic',
      //     words: ['advice', 'cloth', 'thumb', 'label', 'half', 'music', 'decide', 'joke', 'hockey', 'during', 'basic', 'depend', 'ticket', 'usage', 'float'],
      //   },
      // });

      // Get wallet UTXOs and change address
      const utxos = await wallet.getUtxos();
      const changeAddress = await wallet.getChangeAddress();

      this.logger.log(`Wallet UTXOs: ${utxos.length}`);
      this.logger.log(`Change address: ${changeAddress}`);

      // Build transaction
      const unsignedTx = await this.meshTxBuilder
        .txOut(recipientAddress, [{ unit: 'lovelace', quantity: amount }])
        .changeAddress(changeAddress)
        .selectUtxosFrom(utxos)
        .complete();

      // Sign transaction
      const signedTx = await wallet.signTx(unsignedTx, true);

      // Submit transaction
      const txHash = await this.provider.submitTx(signedTx);

      this.logger.log(`Transaction submitted successfully: ${txHash}`);
      
      return { txHash };
    } catch (error) {
      this.logger.error('Transaction failed:', error);
      throw error;
    }
  }

  /**
   * Check transaction status
   */
  async getTransactionStatus(txHash: string): Promise<any> {
    try {
      // ✅ Use fetchTxInfo instead of fetchTransactionInfo
      const transaction = await this.provider.fetchTxInfo(txHash);
      
      return {
        txHash,
        blockHeight: transaction.blockHeight,
        // confirmations: transaction.confirmations || 0,
        status: transaction.blockHeight ? 'confirmed' : 'pending',
      };
    } catch (error) {
      this.logger.error(`Failed to fetch transaction ${txHash}:`, error);
      throw error;
    }
  }
}