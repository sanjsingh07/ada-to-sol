import { Wallet } from '@project-serum/anchor';
import { Keypair, Transaction } from '@solana/web3.js';

export class KeypairWallet implements Wallet {
  constructor(readonly payer: Keypair) {}

  get publicKey() {
    return this.payer.publicKey;
  }

  async signTransaction(tx: Transaction): Promise<Transaction> {
    tx.partialSign(this.payer);
    return tx;
  }

  async signAllTransactions(txs: Transaction[]): Promise<Transaction[]> {
    return txs.map((tx) => {
      tx.partialSign(this.payer);
      return tx;
    });
  }
}
