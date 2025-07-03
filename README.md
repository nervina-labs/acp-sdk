# ACP-SDK

## Getting Started with Examples

### Generate Your CKB Address and Obtain Tokens

1. Generate a secp256k1 private key:
  ```shell
  openssl rand -hex 32
  ```
2. Copy the .env.example file to .env:
  ```shell
  cp .env.example .env
  ```
3. Add your generated private key to the `.env` file by updating the `EXAMPLE_CKB_SECP256K1_PRIVATE_KEY` value
4. Generate your Secp256k1/blake160 address using the following command:
    ```shell
    pnpm generateAddress
    ```
5. Visit the testnet explorer in your browser: https://testnet.explorer.nervos.org/address/{your-ckb-address}
6. Obtain CKB and USDI tokens from the faucet
  ![Faucet interface](faucet.png)

### Create ACP (Anyone-Can-Pay) Cells

Use your private key and CKB address to create one or more ACP cells.

> The ACP lock script args are identical to the Secp256k1/blake160 lock args, which is the blake2b hash of the public key.

Set the desired number of cells by modifying the `count` parameter in `examples/createAcpCells.ts` and run the following command in your terminal:

```shell
pnpm createAcpCells
```

### Transfer some USDIs to your ACP address from your secp256k1 ckb address

Transfer some USDIs to your ACP address (It will be automatically generated with `EXAMPLE_CKB_SECP256K1_PRIVATE_KEY` in the example).

Set a number you want to the `usdiAmount` of the `examples/transferUSDIToAcp.ts` and run the following command in your terminal:

```shell
pnpm transferUSDIToAcp
```

### Transfer some USDIs to another ACP address from your ACP address

Transfer some USDIs to another ACP address (another ACP address has been set in the example) from your ACP address.

Set a number you want to the `usdiAmount` and the `toAcpAddress` of the `examples/transferUSDIFromAcpToAcp.ts` and run the following command in your terminal:

```shell
pnpm transferUSDIFromAcpToAcp
```

### Transfer all your USDIs to a non-ACP address from your ACP address

Transfer all your USDIs to a non-ACP address (A JoyID address has been set in the example) from your ACP address and your ACP cells will be destroyed.

Set a CKB address you want to the `toNonAcpAddress` of the `examples/transferAllUSDIFromAcp.ts` and run the following command in your terminal:

```shell
pnpm transferAllUSDIFromAcp
```
   