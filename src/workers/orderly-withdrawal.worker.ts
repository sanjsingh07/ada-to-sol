import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DatabaseService } from 'src/database/database.service';
import { OrderlyService } from 'src/orderly/orderly.service';
import { ChangeNowService } from 'src/change-now/change-now.service';

@Injectable()
export class OrderlyWithdrawalWorker {
  private readonly logger = new Logger(OrderlyWithdrawalWorker.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly orderly: OrderlyService,
    private readonly changeNow: ChangeNowService,
  ) {}

  // Runs every 30 seconds
  @Cron('*/30 * * * * *')
  async pollOrderlyWithdrawals() {
    const pending = await this.db.transaction.findMany({
      where: { status: 'ORDERLY_WITHDRAW_PENDING' },
      //   where: {
      //     status: {
      //       in: ['ORDERLY_WITHDRAW_PENDING', 'ORDERLY_DEPOSIT_CONFIRMED'],
      //     },
      //   },
    });

    for (const tx of pending) {
      try {

        if (tx.status !== 'ORDERLY_WITHDRAW_CONFIRMED') return;

        const history = await this.orderly.getAssetHistory(tx.userAddress, {
          token: 'SOL',
          side: 'WITHDRAW',
          //   status: 'COMPLETED' // testing parameter,will only get completed Tx
        });

        const completed = history.data.rows.find(
          (r: any) =>
            r.trans_status === 'COMPLETED' &&
            Number(r.amount) === tx.fromAmount, // added tx_id matching as well later on
        );

        if (!completed) continue;

        // Mark Orderly confirmed
        await this.db.transaction.update({
          where: { id: tx.id },
          data: { status: 'ORDERLY_WITHDRAW_CONFIRMED' },
        });

        // Create ChangeNow swap (SOL → ADA)
        await this.changeNow.swapSolToAdaAndSendToUser(tx.id);

      } catch (err) {
        this.logger.error(`Orderly poll failed tx=${tx.id}`, err);
      }
    }
  }
}
