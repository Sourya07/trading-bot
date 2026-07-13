import { Buffer } from "buffer";
if (typeof window !== "undefined" && !window.Buffer) {
  (window as any).Buffer = Buffer;
}

import * as anchor from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import idl from "./txhedge.json";

export const TXHEDGE_PROGRAM_ID = new PublicKey("BZ6W4B9Te3nnZWXd19QSaTXDxTF1rtC1je8roTDrorrk");
const SOLANA_RPC_URL = "https://api.devnet.solana.com";

export function getProgram(wallet: any): any {
  const connection = new Connection(SOLANA_RPC_URL, "confirmed");
  
  // Custom adapter for Anchor Wallet interface
  const anchorWallet = {
    publicKey: wallet.publicKey || new PublicKey(wallet.address),
    signTransaction: wallet.signTransaction || (async (tx: any) => tx),
    signAllTransactions: wallet.signAllTransactions || (async (txs: any[]) => txs),
  };

  const provider = new anchor.AnchorProvider(
    connection,
    anchorWallet as any,
    { commitment: "confirmed" }
  );
  
  return new anchor.Program(idl as any, provider) as any;
}

export async function createStrategyOnChain(
  wallet: any,
  matchId: string,
  market: string,
  ruleConfigHash: number[]
) {
  const program = getProgram(wallet);
  const userPubkey = wallet.publicKey || new PublicKey(wallet.address);
  
  const [strategyPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("strategy"), userPubkey.toBuffer(), Buffer.from(matchId)],
    program.programId
  );
  
  const tx = await program.methods
    .createStrategy(matchId, market, ruleConfigHash)
    .accounts({
      strategy: strategyPda,
      authority: userPubkey,
      systemProgram: anchor.web3.SystemProgram.programId,
    } as any)
    .rpc();
    
  return { tx, strategyPda: strategyPda.toBase58() };
}

export async function createPositionOnChain(
  wallet: any,
  strategyPdaStr: string,
  sideStr: "home" | "away" | "draw",
  entryOdds: number,
  stakeCredits: number
) {
  const program = getProgram(wallet);
  const userPubkey = wallet.publicKey || new PublicKey(wallet.address);
  const strategyPda = new PublicKey(strategyPdaStr);
  
  const [positionPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("position"), userPubkey.toBuffer(), strategyPda.toBuffer()],
    program.programId
  );

  // Map side to enum structure
  const side = sideStr === "home" 
    ? { home: {} } 
    : sideStr === "away" 
      ? { away: {} } 
      : { draw: {} };

  // Odds: multiply by 10000 to get basis points (e.g. 2.10 -> 21000 bps)
  const entryOddsBps = new anchor.BN(Math.round(entryOdds * 10000));
  const stake = new anchor.BN(stakeCredits);
  
  const tx = await program.methods
    .createPosition(strategyPda, side as any, entryOddsBps, stake)
    .accounts({
      position: positionPda,
      authority: userPubkey,
      systemProgram: anchor.web3.SystemProgram.programId,
    } as any)
    .rpc();
    
  return { tx, positionPda: positionPda.toBase58() };
}

export async function settlePositionOnChain(
  wallet: any,
  positionPdaStr: string,
  finalOutcomeStr: "home" | "away" | "draw",
  finalScoreHome: number,
  finalScoreAway: number,
  txlineResultHashStr: string
) {
  const program = getProgram(wallet);
  const userPubkey = wallet.publicKey || new PublicKey(wallet.address);
  const positionPda = new PublicKey(positionPdaStr);
  
  const [settlementReceiptPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("settlement"), positionPda.toBuffer()],
    program.programId
  );
  
  const finalOutcome = finalOutcomeStr === "home" 
    ? { home: {} } 
    : finalOutcomeStr === "away" 
      ? { away: {} } 
      : { draw: {} };
      
  // Convert result hash from hex string to 32-byte array
  let hashBytes = new Uint8Array(32);
  if (txlineResultHashStr) {
    // If it's a hex string (e.g. sha256), decode it
    try {
      const cleanHex = txlineResultHashStr.startsWith("0x") ? txlineResultHashStr.slice(2) : txlineResultHashStr;
      const decoded = Buffer.from(cleanHex, "hex");
      hashBytes.set(decoded.subarray(0, 32));
    } catch {
      // Fallback: decode text
      const encoder = new TextEncoder();
      const encoded = encoder.encode(txlineResultHashStr);
      hashBytes.set(encoded.subarray(0, 32));
    }
  }
  
  const tx = await program.methods
    .settlePosition(
      finalOutcome as any,
      finalScoreHome,
      finalScoreAway,
      Array.from(hashBytes)
    )
    .accounts({
      position: positionPda,
      settlementReceipt: settlementReceiptPda,
      authority: userPubkey,
      systemProgram: anchor.web3.SystemProgram.programId,
    } as any)
    .rpc();
    
  return { tx, settlementReceiptPda: settlementReceiptPda.toBase58() };
}
