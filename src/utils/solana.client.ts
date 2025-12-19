import { Injectable } from '@nestjs/common';
import {
  Connection,
  Keypair,
  Transaction,
  sendAndConfirmTransaction,
  PublicKey,
} from '@solana/web3.js';
import bs58 from 'bs58';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SolanaClient {
  connection: Connection;

  constructor(private readonly config: ConfigService) {
    const rpcUrl = this.config.getOrThrow<string>('SOLANA_RPC_URL');
    this.connection = new Connection(rpcUrl, 'confirmed');
  }

  keypairFromBase58(secret: string): Keypair {
    const decoded = bs58.decode(secret);
    return Keypair.fromSecretKey(decoded);
  }

  async send(tx: Transaction, signer: Keypair) {
    tx.feePayer = signer.publicKey;
    tx.recentBlockhash = (await this.connection.getLatestBlockhash()).blockhash;
    return sendAndConfirmTransaction(this.connection, tx, [signer]);
  }

  async waitForSolArrival(
    solanaAddress: string,
    minLamports = 1n,
  ): Promise<bigint> {
    const pubkey = new PublicKey(solanaAddress);

    while (true) {
      const balance = await this.connection.getBalance(pubkey);
      if (BigInt(balance) >= minLamports) {
        return BigInt(balance);
      }
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}
