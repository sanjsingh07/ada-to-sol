export interface CardanoConfig {
  network: 'mainnet' | 'preprod' | 'preview';
  blockfrostApiKey: string;
  blockfrostUrl: string;
}