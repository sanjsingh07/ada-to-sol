import { Injectable, HttpException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class ChangeNowService {
  constructor(private readonly httpService: HttpService) {}

  async getMinAmount(params: {
    fromCurrency: string;
    toCurrency: string;
    fromNetwork: string;
    toNetwork: string;
    flow?: string;
  }) {
    const { fromCurrency, toCurrency, fromNetwork, toNetwork, flow = 'standard' } = params;

    const url = `https://api.changenow.io/v2/exchange/min-amount`;

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
}
