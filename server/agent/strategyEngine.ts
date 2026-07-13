import { query, queryOne } from "../db";
import type { Strategy, Position, AgentLog } from "../db";
import { getMatch, hashSnapshot, decimalToImpliedProb } from "../txline";
import type { WebSocket } from "ws";

function broadcast(clients: Set<WebSocket>, msg: unknown) {
  const data = JSON.stringify(msg);
  clients.forEach((ws) => {
    if (ws.readyState === 1) ws.send(data);
  });
}

export async function createStrategy(
  wallet: string,
  matchId: string,
  template: string,
  ruleConfig: Record<string, unknown>,
  anchorStrategySignature: string | null = null
): Promise<Strategy | null> {
  try {
    return await queryOne<Strategy>(
      `INSERT INTO strategies (wallet, match_id, template, rule_config, agent_active, anchor_strategy_signature)
       VALUES ($1, $2, $3, $4, false, $5)
       RETURNING *`,
      [wallet, matchId, template, JSON.stringify(ruleConfig), anchorStrategySignature]
    );
  } catch (err) {
    console.error("Error creating strategy:", err);
    return null;
  }
}

export async function getStrategies(wallet?: string): Promise<Strategy[]> {
  try {
    if (wallet) {
      return await query<Strategy>(
        `SELECT * FROM strategies WHERE wallet = $1 ORDER BY created_at DESC`,
        [wallet]
      );
    }
    return await query<Strategy>(
      `SELECT * FROM strategies ORDER BY created_at DESC`
    );
  } catch (err) {
    console.error("Error getting strategies:", err);
    return [];
  }
}

export async function getStrategy(strategyId: string): Promise<Strategy | null> {
  try {
    return await queryOne<Strategy>(
      `SELECT * FROM strategies WHERE id = $1`,
      [strategyId]
    );
  } catch (err) {
    console.error("Error getting strategy:", err);
    return null;
  }
}

export async function toggleAgent(
  strategyId: string,
  active: boolean,
  clients: Set<WebSocket>
): Promise<Strategy | null> {
  try {
    const strategy = await queryOne<Strategy>(
      `UPDATE strategies SET agent_active = $1 WHERE id = $2 RETURNING *`,
      [active, strategyId]
    );
    if (!strategy) {
      console.error("Error toggling agent: strategy not found");
      return null;
    }

    const match = await getMatch(strategy.match_id);

    await logAgentEvent(strategy.id, strategy.match_id, "info", active
      ? `Agent started for ${match?.home_team} vs ${match?.away_team} using ${strategy.template.replace(/_/g, " ")} strategy. Monitoring TxLINE data for trigger conditions.`
      : `Agent stopped. No longer monitoring ${match?.home_team} vs ${match?.away_team}.`, {});

    broadcast(clients, {
      type: "agent_event",
      data: { strategy_id: strategy.id, active },
    });

    return strategy;
  } catch (err) {
    console.error("Error toggling agent:", err);
    return null;
  }
}

export async function logAgentEvent(
  strategyId: string,
  matchId: string,
  eventType: string,
  message: string,
  txlineSnapshot: Record<string, unknown>
): Promise<AgentLog | null> {
  try {
    return await queryOne<AgentLog>(
      `INSERT INTO agent_logs (strategy_id, match_id, event_type, message, txline_snapshot)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [strategyId, matchId, eventType, message, JSON.stringify(txlineSnapshot)]
    );
  } catch (err) {
    console.error("Error logging agent event:", err);
    return null;
  }
}

export async function getAgentLogs(strategyId: string): Promise<AgentLog[]> {
  try {
    return await query<AgentLog>(
      `SELECT * FROM agent_logs WHERE strategy_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [strategyId]
    );
  } catch (err) {
    console.error("Error getting agent logs:", err);
    return [];
  }
}

export async function createPosition(
  strategyId: string,
  matchId: string,
  wallet: string,
  side: string,
  entryOdds: number,
  stakeCredits: number,
  positionType: string,
  triggerReason: string,
  txlineSnapshotHash: string,
  anchorSignature: string | null
): Promise<Position | null> {
  try {
    const position = await queryOne<Position>(
      `INSERT INTO positions (strategy_id, match_id, wallet, side, entry_odds, stake_credits, status, position_type, trigger_reason, txline_snapshot_hash, anchor_position_signature)
       VALUES ($1, $2, $3, $4, $5, $6, 'open', $7, $8, $9, $10)
       RETURNING *`,
      [strategyId, matchId, wallet, side, entryOdds, stakeCredits, positionType, triggerReason, txlineSnapshotHash, anchorSignature]
    );

    // Deduct stake credits from wallet balance in DB
    if (position) {
      const walletRecord = await queryOne<{ balance: number }>(
        `SELECT balance FROM wallets WHERE address = $1`,
        [wallet]
      );
      if (walletRecord) {
        const newBalance = Math.max(0, Number(walletRecord.balance) - Number(stakeCredits));
        await query(
          `UPDATE wallets SET balance = $1 WHERE address = $2`,
          [newBalance, wallet]
        );
      }
    }

    return position;
  } catch (err) {
    console.error("Error creating position:", err);
    return null;
  }
}

export async function getPositions(strategyId: string): Promise<Position[]> {
  try {
    return await query<Position>(
      `SELECT * FROM positions WHERE strategy_id = $1 ORDER BY created_at DESC`,
      [strategyId]
    );
  } catch (err) {
    console.error("Error getting positions:", err);
    return [];
  }
}

export async function getOpenPositions(matchId: string): Promise<Position[]> {
  try {
    return await query<Position>(
      `SELECT * FROM positions WHERE match_id = $1 AND status = 'open' ORDER BY created_at DESC`,
      [matchId]
    );
  } catch (err) {
    console.error("Error getting open positions:", err);
    return [];
  }
}

export async function settlePosition(
  positionId: string,
  finalOutcome: string,
  finalScoreHome: number,
  finalScoreAway: number,
  txlineResultHash: string,
  anchorSettleSignature: string | null,
  clients: Set<WebSocket>
): Promise<void> {
  const position = await queryOne<Position>(
    `SELECT * FROM positions WHERE id = $1`,
    [positionId]
  );
  if (!position) return;

  const won = position.side === finalOutcome;
  const stakeVal = Number(position.stake_credits);
  const pnl = won
    ? stakeVal * (Number(position.entry_odds) - 1)
    : -stakeVal;

  await query(
    `UPDATE positions SET status = 'settled', pnl_credits = $1, settled_at = now() WHERE id = $2`,
    [pnl, positionId]
  );

  await query(
    `INSERT INTO settlements (position_id, match_id, final_outcome, final_score_home, final_score_away, txline_result_hash, anchor_settle_signature, pnl_credits)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [positionId, position.match_id, finalOutcome, finalScoreHome, finalScoreAway, txlineResultHash, anchorSettleSignature, pnl]
  );

  const wallet = await queryOne<{ balance: number }>(
    `SELECT balance FROM wallets WHERE address = $1`,
    [position.wallet]
  );

  if (wallet) {
    // Explicitly parse balance, stake, and PnL to prevent string concatenation
    const newBalance = Number(wallet.balance) + stakeVal + Number(pnl);
    await query(
      `UPDATE wallets SET balance = $1 WHERE address = $2`,
      [newBalance, position.wallet]
    );
  }

  broadcast(clients, {
    type: "position_settled",
    data: {
      position_id: positionId,
      match_id: position.match_id,
      final_outcome: finalOutcome,
      pnl,
      txline_result_hash: txlineResultHash,
    },
  });
}

export async function handleGoalEvent(
  matchId: string,
  scoringTeam: "home" | "away",
  _minute: number,
  clients: Set<WebSocket>
): Promise<void> {
  const match = await getMatch(matchId);
  if (!match) return;

  const strategies = await query<Strategy>(
    `SELECT * FROM strategies WHERE match_id = $1 AND agent_active = true`,
    [matchId]
  );

  if (!strategies || strategies.length === 0) return;

  const snapshot = {
    match_id: matchId,
    home_team: match.home_team,
    away_team: match.away_team,
    score_home: match.score_home,
    score_away: match.score_away,
    odds_home: Number(match.odds_home),
    odds_away: Number(match.odds_away),
    timestamp: new Date().toISOString(),
  };
  const snapshotHash = hashSnapshot(snapshot);

  for (const strategy of strategies) {
    if (strategy.template === "goal_shift_hedge") {
      const ruleConfig = strategy.rule_config as {
        primary_side?: string;
        primary_stake?: number;
        hedge_stake?: number;
      };
      const primarySide = ruleConfig.primary_side || "home";
      const hedgeStake = ruleConfig.hedge_stake || 50;

      const opponentScored =
        (primarySide === "home" && scoringTeam === "away") ||
        (primarySide === "away" && scoringTeam === "home");

      if (opponentScored) {
        const hedgeSide = scoringTeam === "home" ? "home" : "away";
        const hedgeOdds = scoringTeam === "home" ? Number(match.odds_home) : Number(match.odds_away);

        const message = `Goal detected: ${scoringTeam === "home" ? match.home_team : match.away_team} scored. Your primary position is on ${primarySide === "home" ? match.home_team : match.away_team}. Opening hedge on ${hedgeSide === "home" ? match.home_team : match.away_team} at ${hedgeOdds.toFixed(2)} to protect against a shift in momentum. Stake: ${hedgeStake} credits.`;

        await logAgentEvent(strategy.id, matchId, "trigger", message, snapshot);

        const position = await createPosition(
          strategy.id,
          matchId,
          strategy.wallet,
          hedgeSide,
          hedgeOdds,
          hedgeStake,
          "hedge",
          message,
          snapshotHash,
          null
        );

        if (position) {
          broadcast(clients, {
            type: "agent_event",
            data: {
              strategy_id: strategy.id,
              event_type: "trigger",
              message,
              position,
            },
          });
        }
      } else {
        const message = `Goal detected: ${scoringTeam === "home" ? match.home_team : match.away_team} scored. This aligns with your primary position on ${primarySide === "home" ? match.home_team : match.away_team}. No hedge needed — momentum is favorable.`;
        await logAgentEvent(strategy.id, matchId, "info", message, snapshot);
        broadcast(clients, {
          type: "agent_event",
          data: { strategy_id: strategy.id, event_type: "info", message },
        });
      }
    }
  }
}

export async function settleAllForMatch(
  matchId: string,
  finalScoreHome: number,
  finalScoreAway: number,
  txlineResultHash: string,
  clients: Set<WebSocket>
): Promise<void> {
  const match = await getMatch(matchId);
  if (!match) return;

  const finalOutcome =
    finalScoreHome > finalScoreAway ? "home" : finalScoreAway > finalScoreHome ? "away" : "draw";

  const openPositions = await getOpenPositions(matchId);
  for (const position of openPositions) {
    await settlePosition(
      position.id,
      finalOutcome,
      finalScoreHome,
      finalScoreAway,
      txlineResultHash,
      null,
      clients
    );
  }
}
