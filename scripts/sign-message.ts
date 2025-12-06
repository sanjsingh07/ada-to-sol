import {
  BlockfrostProvider,
  MeshWallet,
} from '@meshsdk/core';

// -------------------------------------
// CONFIGURE THESE TWO VALUES
// -------------------------------------

const baseAddressBech32 = "addr_test1qqelrke3nl7czzsvw0jhw46ak7kvve7dvt0rcnq4a20gj52x5yex2q0dtufmht9xtvdmvzf4jw5xp3zg5avg5lxg9t8sn2d00s";
const MNEMONIC = "worry elbow bargain broom produce sort waste bacon safe foam trouble catch noodle hint apology";
const NONCE = "4920616772656520746f20746865207465726d20616e6420636f6e646974696f6e73206f6620746865204d6573683a20306c47687763637a37527150706d367976336e504964536842783862565a7441";
const BLOCKFROST_API_KEY = ''; // for signing tx its not necessary
// -------------------------------------

async function main() {
  if (!MNEMONIC || MNEMONIC.split(" ").length < 12) {
    console.error("❌ Invalid mnemonic");
    process.exit(1);
  }

  const mnemonic = MNEMONIC.trim().split(/\s+/);
  const provider = new BlockfrostProvider(BLOCKFROST_API_KEY!);

  console.log("Deriving wallet from mnemonic...");

  // Loading wallet
  const wallet = new MeshWallet({
    networkId: 0, // 0 for testnet, 1 for mainnet
    fetcher: provider,
    submitter: provider,
    key: {
      type: 'mnemonic',
      words: mnemonic,
    },
  });
    

  // Sign message
  console.log("Signing message...");
  const signature = await wallet.signData(
    NONCE
  )

  console.log("Signature created successfully:");
  console.log(JSON.stringify(signature, null, 2));
  // console.log("wallet address: ", wallet.getAddresses())

}

main().catch((e) => console.error(e));
