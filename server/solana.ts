import { Connection, PublicKey } from "@solana/web3.js";

export const TXHEDGE_PROGRAM_ID =
  process.env.TXHEDGE_PROGRAM_ID || "BZ6W4B9Te3nnZWXd19QSaTXDxTF1rtC1je8roTDrorrk";

export const SOLANA_CLUSTER = process.env.SOLANA_CLUSTER || "devnet";
export const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
const BPF_LOADER_UPGRADEABLE_PROGRAM_ID = new PublicKey("BPFLoaderUpgradeab1e11111111111111111111111");

export type DevnetProgramStatus = {
  cluster: string;
  rpcUrl: string;
  programId: string;
  deployed: boolean;
  executable: boolean;
  owner: string | null;
  lamports: number | null;
  explorerUrl: string;
  error: string | null;
};

export function getExplorerUrl(path: "address" | "tx", value: string): string {
  const clusterQuery = SOLANA_CLUSTER === "mainnet-beta" ? "" : `?cluster=${SOLANA_CLUSTER}`;
  return `https://solscan.io/${path}/${value}${clusterQuery}`;
}

export async function getTxHedgeProgramStatus(): Promise<DevnetProgramStatus> {
  const connection = new Connection(SOLANA_RPC_URL, "confirmed");
  const programId = new PublicKey(TXHEDGE_PROGRAM_ID);
  const explorerUrl = getExplorerUrl("address", TXHEDGE_PROGRAM_ID);

  try {
    const account = await connection.getAccountInfo(programId, "confirmed");

    if (!account) {
      return {
        cluster: SOLANA_CLUSTER,
        rpcUrl: SOLANA_RPC_URL,
        programId: TXHEDGE_PROGRAM_ID,
        deployed: false,
        executable: false,
        owner: null,
        lamports: null,
        explorerUrl,
        error: "Program account was not found on the configured cluster.",
      };
    }

    const owner = account.owner.toBase58();

    return {
      cluster: SOLANA_CLUSTER,
      rpcUrl: SOLANA_RPC_URL,
      programId: TXHEDGE_PROGRAM_ID,
      deployed: owner === BPF_LOADER_UPGRADEABLE_PROGRAM_ID.toBase58(),
      executable: account.executable,
      owner,
      lamports: account.lamports,
      explorerUrl,
      error: null,
    };
  } catch (error) {
    return {
      cluster: SOLANA_CLUSTER,
      rpcUrl: SOLANA_RPC_URL,
      programId: TXHEDGE_PROGRAM_ID,
      deployed: false,
      executable: false,
      owner: null,
      lamports: null,
      explorerUrl,
      error: error instanceof Error ? error.message : "Unable to query Solana devnet.",
    };
  }
}
