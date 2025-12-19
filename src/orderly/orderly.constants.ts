// ALL these constant are for TESTNET
import { PublicKey } from '@solana/web3.js';

export const ORDERLY = {
  // BROKER_ID: 'demo', 
  // SOLANA_CHAIN_ID: 900, // Orderly Solana chain id
  CHAIN_TYPE: 'SOL'
};

// TESTNET CONTRACT ADDRESS
export const SOLANA_VAULT = {
  PROGRAM_ID: new PublicKey('9shwxWDUNhtwkHocsUAmrNAQfBH2DHh4njdAEdHZZkF2'),
  VAULT_AUTHORITY: new PublicKey('CT9AgCVpWQCuPyVMriYKxTdrkH5DFmn2oiYhGKcNwPCm'),
  SOL_VAULT: new PublicKey('HL4NkDbY9FgQySWJwpK92W8iXq1b5wovLvL7K3roedCj'),
  OAPP_CONFIG: new PublicKey('5YsvfmqrMY9KWskY1e1uU2haJJZZHK7UAw8V6qpDsYm5'),
  PEER: new PublicKey('5cX2eHYKTJLSJknNxFP1o79VKkB85qGVcR1Jys78pn9T'),
  ENFORCED_OPTIONS: new PublicKey('BbGKfxuPwDmu58BjPpd7PMG69TqnZjSpKaLDMgf9E9Dr'),
  LEDGER: '0x1826B75e2ef249173FC735149AE4B8e9ea10abff' //(verifying contract for EIP-712 withdraw msg)
};
