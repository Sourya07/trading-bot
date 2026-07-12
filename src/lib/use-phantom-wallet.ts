import { useState, useEffect, useCallback } from "react";

type PhantomProvider = {
  connect: () => Promise<{ publicKey: { toString: () => string } }>;
  disconnect: () => Promise<void>;
  on: (event: string, handler: (...args: unknown[]) => void) => void;
  isConnected: boolean;
  publicKey: { toString: () => string } | null;
};

declare global {
  interface Window {
    phantom?: {
      solana?: PhantomProvider;
    };
  }
}

export function usePhantomWallet() {
  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  const getProvider = useCallback((): PhantomProvider | null => {
    if (typeof window === "undefined") return null;
    
    // Log detected providers to help debug in developer console
    console.log("Wallet Detection:", {
      phantom: window.phantom,
      solana: (window as any).solana,
      isPhantom: (window as any).solana?.isPhantom
    });

    if (window.phantom?.solana) {
      return window.phantom.solana;
    }
    
    const anySolana = (window as any).solana;
    if (anySolana?.isPhantom) {
      return anySolana;
    }
    
    if (anySolana) {
      return anySolana;
    }
    
    return null;
  }, []);

  useEffect(() => {
    const provider = getProvider();
    if (!provider) return;

    if (provider.isConnected && provider.publicKey) {
      setConnected(true);
      setAddress(provider.publicKey.toString());
    }

    provider.on("connect", (publicKey: unknown) => {
      setConnected(true);
      setAddress((publicKey as { toString: () => string }).toString());
    });

    provider.on("disconnect", () => {
      setConnected(false);
      setAddress(null);
    });
  }, [getProvider]);

  const connect = useCallback(async () => {
    const provider = getProvider();
    if (!provider) {
      window.open("https://phantom.app/", "_blank");
      return;
    }
    setConnecting(true);
    try {
      const resp = await provider.connect();
      setAddress(resp.publicKey.toString());
      setConnected(true);
    } catch (err) {
      console.error("Phantom connection error:", err);
    } finally {
      setConnecting(false);
    }
  }, [getProvider]);

  const disconnect = useCallback(async () => {
    const provider = getProvider();
    if (!provider) return;
    await provider.disconnect();
    setConnected(false);
    setAddress(null);
  }, [getProvider]);

  return { connected, address, connecting, connect, disconnect };
}
