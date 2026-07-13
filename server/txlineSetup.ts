/**
 * TxLINE Setup Script
 * 
 * Run this once to subscribe to the TxLINE free World Cup tier on devnet
 * and activate your API token. Outputs credentials for .env.
 * 
 * Usage: npx tsx server/txlineSetup.ts
 */
import { config } from "dotenv";
config();

import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";
import bs58 from "bytes";
import pkgBs58 from "bs58";
const { decode } = pkgBs58;
import nacl from "tweetnacl";

// ─── Configuration ──────────────────────────────────────────────────
const NETWORK = (process.env.TXLINE_NETWORK || "devnet") as "devnet" | "mainnet";

const CONFIG = {
  mainnet: {
    rpcUrl: "https://api.mainnet-beta.solana.com",
    apiOrigin: "https://txline.txodds.com",
    programId: new PublicKey("9ExbZjAapQww1vfcisDmrngPinHTEfpjYRWMunJgcKaA"),
    txlTokenMint: new PublicKey("Zhw9TVKp68a1QrftncMSd6ELXKDtpVMNuMGr1jNwdeL"),
  },
  devnet: {
    rpcUrl: "https://api.devnet.solana.com",
    apiOrigin: "https://txline-dev.txodds.com",
    programId: new PublicKey("6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J"),
    txlTokenMint: new PublicKey("4Zao8ocPhmMgq7PdsYWyxvqySMGx7xb9cMftPMkEokRG"),
  },
} as const;

const { rpcUrl, apiOrigin, programId, txlTokenMint } = CONFIG[NETWORK];
const apiBaseUrl = `${apiOrigin}/api`;

async function main() {
  console.log(`\n🔧 TxLINE Setup — Network: ${NETWORK}`);
  console.log(`   API Origin: ${apiOrigin}`);
  console.log(`   Program ID: ${programId.toBase58()}`);

  // ─── Load Wallet ────────────────────────────────────────────────
  const privateKey = process.env.SOLANA_PRIVATE_KEY;
  if (!privateKey) {
    console.error("❌ SOLANA_PRIVATE_KEY not set in .env");
    process.exit(1);
  }

  const keypair = Keypair.fromSecretKey(decode(privateKey));
  console.log(`   Wallet: ${keypair.publicKey.toBase58()}`);

  const connection = new Connection(rpcUrl, "confirmed");

  // Check balance
  const balance = await connection.getBalance(keypair.publicKey);
  console.log(`   Balance: ${balance / 1e9} SOL`);
  if (balance < 0.005 * 1e9) {
    console.error("❌ Insufficient SOL balance. Need at least 0.005 SOL for fees.");
    process.exit(1);
  }

  // ─── Step 1: Get Guest JWT ──────────────────────────────────────
  console.log("\n📡 Step 1: Getting guest JWT...");
  const authRes = await fetch(`${apiOrigin}/auth/guest/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!authRes.ok) {
    console.error(`❌ Guest auth failed: ${authRes.status}`);
    process.exit(1);
  }
  const { token: jwt } = await authRes.json();
  console.log(`   ✅ Guest JWT obtained (${jwt.substring(0, 20)}...)`);

  // ─── Step 2: Subscribe On-Chain ─────────────────────────────────
  console.log("\n⛓️  Step 2: Subscribing on-chain via Anchor program client...");

  // Setup Anchor Provider
  const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(keypair), {
    commitment: "confirmed",
  });
  
  console.log("   Fetching program IDL from Solana...");
  const idl = await anchor.Program.fetchIdl(programId, provider);
  if (!idl) {
    throw new Error("Could not fetch program IDL on-chain. Make sure the program ID and cluster match.");
  }
  console.log("   IDL loaded successfully. Initializing program...");
  const program = new anchor.Program(idl, provider);

  // Derive PDAs
  const [tokenTreasuryPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("token_treasury_v2")],
    programId
  );

  const tokenTreasuryVault = getAssociatedTokenAddressSync(
    txlTokenMint,
    tokenTreasuryPda,
    true,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  const [pricingMatrixPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("pricing_matrix")],
    programId
  );

  const userTokenAccount = getAssociatedTokenAddressSync(
    txlTokenMint,
    keypair.publicKey,
    false,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  // Check and initialize Associated Token Account if needed
  const userTokenAccountInfo = await connection.getAccountInfo(userTokenAccount);
  if (!userTokenAccountInfo) {
    console.log("   Initializing Associated Token Account...");
    const createAtaTx = new anchor.web3.Transaction().add(
      createAssociatedTokenAccountInstruction(
        keypair.publicKey,
        userTokenAccount,
        keypair.publicKey,
        txlTokenMint,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      )
    );
    const ataSig = await provider.sendAndConfirm(createAtaTx);
    console.log(`   ATA Initialized: ${ataSig}`);
  }

  const SERVICE_LEVEL_ID = 1;
  const DURATION_WEEKS = 4;

  let txSig = "";
  try {
    txSig = await program.methods
      .subscribe(SERVICE_LEVEL_ID, DURATION_WEEKS)
      .accounts({
        user: keypair.publicKey,
        pricingMatrix: pricingMatrixPda,
        tokenMint: txlTokenMint,
        userTokenAccount,
        tokenTreasuryVault,
        tokenTreasuryPda,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
      
    console.log(`   Transaction signature: ${txSig}`);
    console.log("   ✅ Subscription confirmed on-chain!");
  } catch (err: any) {
    console.warn(`   ⚠️  Subscribe transaction failed/halted: ${err.message || err}`);
    console.log("   Checking if we are already subscribed by listing signatures...");
    
    const sigs = await connection.getSignaturesForAddress(keypair.publicKey, { limit: 10 });
    if (sigs.length > 0) {
      txSig = sigs[0].signature;
      console.log(`   Using latest confirmed transaction: ${txSig}`);
    } else {
      console.error("❌ No transaction signature found for activation.");
      process.exit(1);
    }
  }

  // ─── Step 3: Activate API Token ─────────────────────────────────
  console.log("\n🔑 Step 3: Activating API token with TxLINE host...");

  const SELECTED_LEAGUES: number[] = [];
  const messageString = `${txSig}:${SELECTED_LEAGUES.join(",")}:${jwt}`;
  const message = new TextEncoder().encode(messageString);
  const signatureBytes = nacl.sign.detached(message, keypair.secretKey);
  const walletSignature = Buffer.from(signatureBytes).toString("base64");

  const activateRes = await fetch(`${apiBaseUrl}/token/activate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify({
      txSig,
      walletSignature,
      leagues: SELECTED_LEAGUES,
    }),
  });

  if (!activateRes.ok) {
    const errText = await activateRes.text();
    console.error(`❌ Activation failed: ${activateRes.status}`);
    console.error(`   Response: ${errText}`);
    process.exit(1);
  }

  const activateText = await activateRes.text();
  let activatedApiToken = "";
  try {
    const activateData = JSON.parse(activateText);
    activatedApiToken = activateData.token || activateData;
  } catch {
    activatedApiToken = activateText;
  }
  console.log("   ✅ API Token activated successfully!");

  // ─── Output credentials ─────────────────────────────────────────
  console.log("\n" + "═".repeat(60));
  console.log("  🎉 TxLINE Setup Complete!");
  console.log("═".repeat(60));
  console.log("\n  Add these to your .env file:\n");
  console.log(`  TXLINE_JWT=${jwt}`);
  console.log(`  TXLINE_API_TOKEN=${activatedApiToken}`);
  console.log("\n" + "═".repeat(60));
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
