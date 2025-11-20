import { Injectable } from '@nestjs/common';

@Injectable()
export class CardanoService {

    // constructor(private readonly httpService: HttpService, private readonly databaseService: DatabaseService) {}
    async sendCardanoPayment({
        privateKey,
        fromAddress,
        toAddress,
        amountLovelace,
        }: any) {
        const S = CardanoSerializationLib; // alias

        const paymentKey = S.PrivateKey.from_normal_bytes(Buffer.from(privateKey, 'hex'));

        const utxos = await this.cardanoProvider.getUtxos(fromAddress);

        const txBuilder = this.cardanoProvider.getTxBuilder();

        // Add UTXOs
        utxos.forEach(utxo => {
            txBuilder.add_input(
            utxo.txHash,
            utxo.outputIndex,
            utxo.amount,
            );
        });

        // Add output
        txBuilder.add_output(
            S.TransactionOutput.new(
            S.Address.from_bech32(toAddress),
            S.Value.new(S.BigNum.from_str(amountLovelace.toString()))
            )
        );

        // Build tx
        const txBody = txBuilder.build();
        const witnessSet = S.TransactionWitnessSet.new();
        const vkeyWitnesses = S.Vkeywitnesses.new();

        const signature = paymentKey.sign(txBody.hash());
        const vkeyWitness = S.Vkeywitness.new(
            S.Vkey.new(paymentKey.to_public()),
            S.Ed25519Signature.from_hex(Buffer.from(signature).toString('hex'))
        );

        vkeyWitnesses.add(vkeyWitness);
        witnessSet.set_vkeys(vkeyWitnesses);

        const signedTx = S.Transaction.new(txBody, witnessSet);
        const txHash = await this.cardanoProvider.submitTransaction(signedTx);

        return txHash;
    }

}
