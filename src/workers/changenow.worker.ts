import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { DatabaseService } from 'src/database/database.service';
import { OrderlyService } from 'src/orderly/orderly.service';

@Injectable()
export class ChangeNowWorker {
  private readonly logger = new Logger(ChangeNowWorker.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly http: HttpService,
    private readonly orderlyService: OrderlyService,
  ) {}

  @Cron('*/45 * * * * *')
  async pollChangeNow() {
    const pending = await this.db.transaction.findMany({
      where: {
        status: {
          in: ['CHANGENOW_CREATED', 'CHANGENOW_EXCHANGING'],
        },
      },
    });

    for (const tx of pending) {
      try {
        const res = await firstValueFrom(
          this.http.get(`${process.env.CHANGENOW_API_URL}/exchange/by-id`, {
            params: { id: tx.exchangeId },
            headers: {
              'x-changenow-api-key': process.env.CHANGENOW_API_KEY!,
            },
          }),
        );

        const status = res.data.status;

        if (status === 'exchanging') {
          await this.db.transaction.update({
            where: { id: tx.id },
            data: { status: 'CHANGENOW_EXCHANGING' },
          });
          continue;
        }

        if (status === 'finished') {
          await this.db.transaction.update({
            where: { id: tx.id },
            data: {
              status: 'CHANGENOW_COMPLETED',
              toAmount: res.data.toAmount,
            },
          });

          // ─────────────────────────────
          // WITHDRAW FLOW
          // Orderly → SOL → ChangeNow → ADA → user
          // Nothing more to do here
          // ─────────────────────────────
          if (tx.type === 'WITHDRAW') {
            await this.db.transaction.update({
              where: { id: tx.id },
              data: { status: 'COMPLETED' },
            });
            continue;
          }

          // ─────────────────────────────
          // DEPOSIT FLOW
          // ADA → ChangeNow → SOL → Orderly deposit
          // ─────────────────────────────
          if (tx.type === 'DEPOSIT') {
            // Convert SOL → lamports
            const lamports = BigInt(
              Math.floor(Number(res.data.toAmount) * 1_000_000_000),
            );

            await this.orderlyService.depositSolForUser({
              walletAddress: tx.userAddress,
              amountLamports: lamports,
              transactionId: tx.id,
            });
          }
        }
      } catch (err) {
        this.logger.error(`ChangeNow poll failed tx=${tx.id}`, err);
        await this.db.transaction.update({ where: { id: tx.id }, data: { status: 'FAILED' } });
      }
    }
  }
}
