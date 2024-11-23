import {Connection, Keypair, PublicKey} from "@solana/web3.js";
import {SolanaTracker} from "solana-swap";
import {performSwap, SOL_ADDR} from "./lib.js";
import base58 from "bs58";

const RPC_URL = ""; // Quicknode or Helius give good rpc urls
const PRIVKEY = ""; // the private key of the account who will buy and sell, in base58 (phantom export for example)
const TOKEN_ADDR = ""; // Put the address of the token you want to bump here

const SOL_BUY_AMOUNT = 0.011; // here you can choose to increase/decrease the buy amount

const FEES = 0.0005; // here you can adjust the fees
const SLIPPAGE = 20; // here you can adjust the slippage

async function swap(tokenIn, tokenOut, solanaTracker, keypair, connexion, amount) {

    try {
        const swapResponse = await solanaTracker.getSwapInstructions(
            tokenIn, // From Token
            tokenOut, // To Token
            amount, // Amount to swap
            SLIPPAGE, // Slippage
            keypair.publicKey.toBase58(), // Payer public key
            FEES, // Priority fee (Recommended while network is congested) => you can adapt to increase / decrease the speed of your transactions
            false // Force legacy transaction for Jupiter
        );

        console.log("Send swap transaction...");

        const tx = await performSwap(swapResponse, keypair, connexion, amount, tokenIn, {
            sendOptions: {skipPreflight: true},
            confirmationRetries: 30,
            confirmationRetryTimeout: 1000,
            lastValidBlockHeightBuffer: 150,
            resendInterval: 1000,
            confirmationCheckInterval: 1000,
            skipConfirmationCheck: true
        });

        console.log("Swap sent : " + tx);

    } catch (e) {
        console.log("Error when trying to swap")
    }
}

async function getTokenBalance(connection, owner, tokenAddr) {
    var result = 350000
    try{
        result = await connection.getTokenAccountsByOwner(owner, {mint: new PublicKey(tokenAddr)});
        const info = await connection.getTokenAccountBalance(result.value[0].pubkey);
    if (info.value.uiAmount == null) throw new Error('No balance found');
    return info.value.uiAmount;
    }catch{
        return result;
    }

}

async function main() {

    const keypair = Keypair.fromSecretKey(base58.decode(PRIVKEY));
    const solanaTracker = new SolanaTracker(keypair, RPC_URL);
    const connexion = new Connection(RPC_URL);

    while (true) {

        // Buy
        const promises = [];
        promises.push(swap(SOL_ADDR, TOKEN_ADDR, solanaTracker, keypair, connexion, SOL_BUY_AMOUNT));
        promises.push(swap(SOL_ADDR, TOKEN_ADDR, solanaTracker, keypair, connexion, SOL_BUY_AMOUNT));
        promises.push(swap(SOL_ADDR, TOKEN_ADDR, solanaTracker, keypair, connexion, SOL_BUY_AMOUNT));
        promises.push(swap(SOL_ADDR, TOKEN_ADDR, solanaTracker, keypair, connexion, SOL_BUY_AMOUNT));
        await Promise.all(promises);

        // Sell
        const balance = Math.round(await getTokenBalance(connexion, keypair.publicKey, TOKEN_ADDR));
        await swap(TOKEN_ADDR, SOL_ADDR, solanaTracker, keypair, connexion, balance);

        // Pause
        await new Promise(r => setTimeout(r, 2000)); // it's in milliseconds
    }
}

main();
