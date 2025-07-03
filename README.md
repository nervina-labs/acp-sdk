# acp-sdk

## How to Use Examples

1. Generate a secp256k1 private key
   ```shell
   openssl rand -hex 32
   ```
2. Copy the .env.example file to .env:
   ```
   cp .env.example .env
   ```
3. Edit the `EXAMPLE_CKB_SECP256K1_PRIVATE_KEY` of .env with your generated private key above
4. Generate your Secp256k1/blake160 address through the `pnpm generateAddress`
5. Visit the url in your browser: https://testnet.explorer.nervos.org/address/{your-ckb-address}
6. Get some CKB and USDI with the faucet
   ![alt text](faucet.png)