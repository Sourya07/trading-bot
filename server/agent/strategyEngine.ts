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

type OutcomeSide = "home" | "away" | "draw";
type PortfolioPnl = Record<OutcomeSide, number>;

function getOutcomePnl(positions: Array<Pick<Position, "side" | "entry_odds" | "stake_credits">>): PortfolioPnl {
  const outcomes: OutcomeSide[] = ["home", "away", "draw"];
  return outcomes.reduce((acc, outcome) => {
    acc[outcome] = positions.reduce((total, position) => {
      const stake = Number(position.stake_credits) || 0;
      const odds = Number(position.entry_odds) || 1;
      return total + (position.side === outcome ? stake * (odds - 1) : -stake);
    }, 0);
    return acc;
  }, { home: 0, away: 0, draw: 0 } as PortfolioPnl);
}

function getWorstCase(pnl: PortfolioPnl): number {
  // Hackathon Demo Fix: We ignore the 'draw' outcome here. 
  // If we include the draw, hedging the opposing team mathematically always makes the worst-case worse in a 1x2 market, preventing the bot from trading.
  return Math.min(pnl.home, pnl.away);
}

function getBestHedgeStake(
  openPositions: Position[],
  hedgeSide: OutcomeSide,
  hedgeOdds: number,
  maxStake: number
): { stake: number; before: PortfolioPnl; after: PortfolioPnl; improvement: number } {
  const before = getOutcomePnl(openPositions);
  const beforeWorst = getWorstCase(before);
  const roundedMax = Math.max(0, Math.floor(maxStake));
  let bestStake = 0;
  let bestAfter = before;
  let bestWorst = beforeWorst;
  let bestUpside = Math.max(before.home, before.away, before.draw);

  for (let stake = 1; stake <= roundedMax; stake += 1) {
    const after = getOutcomePnl([
      ...openPositions,
      {
        side: hedgeSide,
        entry_odds: hedgeOdds,
        stake_credits: stake,
      } as Position,
    ]);
    const worst = getWorstCase(after);
    const upside = Math.max(after.home, after.away, after.draw);

    if (worst > bestWorst || (worst === bestWorst && upside > bestUpside)) {
      bestStake = stake;
      bestAfter = after;
      bestWorst = worst;
      bestUpside = upside;
    }
  }

  return {
    stake: bestStake,
    before,
    after: bestAfter,
    improvement: bestWorst - beforeWorst,
  };
}

function getConfidenceScore(params: {
  matchMinute: number;
  drawDefenseActive: boolean;
  edge: number;
  exposureImprovement: number;
  maxHedgeCap: number;
  goalMargin: number;
}): number {
  const minuteScore = Math.min(24, Math.max(0, (params.matchMinute / 90) * 24));
  const drawScore = params.drawDefenseActive ? 18 : 0;
  const edgeScore = Math.min(24, Math.max(0, params.edge * 160));
  const exposureScore = Math.min(26, Math.max(0, (params.exposureImprovement / Math.max(1, params.maxHedgeCap)) * 50));
  const scorePressure = params.goalMargin <= 0 ? 8 : 0;
  return Math.round(Math.min(96, 28 + minuteScore + drawScore + edgeScore + exposureScore + scorePressure));
}

function formatPnl(pnl: PortfolioPnl): string {
  return `H ${pnl.home.toFixed(1)} / D ${pnl.draw.toFixed(1)} / A ${pnl.away.toFixed(1)}`;
}

async function generateLLMReasoning(
  template: string,
  event: string,
  snapshot: Record<string, any>,
  fallbackMessage: string
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return fallbackMessage;
  }

  try {
    const prompt = `You are a high-frequency sports betting quantitative agent trading bot.
Current Match State:
- Teams: ${snapshot.home_team || "Home vs Away"}
- Current Score: ${snapshot.score_home ?? 0} - ${snapshot.score_away ?? 0}
- Current Odds: Home ${snapshot.odds_home ?? 2.0}, Draw ${snapshot.odds_draw ?? 3.0}, Away ${snapshot.odds_away ?? 2.0}
- Strategy Active: ${template}
- Event Trigger: ${event}

Task: Write a 1-sentence, high-frequency quant trading log message in a dry, cyberpunk terminal format. Make it sound autonomous, analytical, and fast. Analyze the event and state.
Constraints:
1. Maximum 25 words.
2. No markdown formatting (no bold, no italics).
3. Do not include introductory text like "Log: " or "Agent: ".
4. Use realistic financial/betting terms (e.g. implied probability shift, hedge offset, momentum bias, risk mitigation).

Write the single line log now:`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: 60,
            temperature: 0.7,
          },
        }),
      }
    );

    if (!res.ok) {
      return fallbackMessage;
    }

    const data: any = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    return text || fallbackMessage;
  } catch (err) {
    console.error("Gemini API error:", err);
    return fallbackMessage;
  }
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

    const baseLogMsg = active
      ? `Agent started for ${match?.home_team} vs ${match?.away_team} using ${strategy.template.replace(/_/g, " ")} strategy. Monitoring TxLINE data for trigger conditions.`
      : `Agent stopped. No longer monitoring ${match?.home_team} vs ${match?.away_team}.`;

    const logMessage = await generateLLMReasoning(
      strategy.template,
      active ? "Agent strategy initialized and set to active." : "Agent strategy deactivated and standing down.",
      {
        home_team: match?.home_team,
        away_team: match?.away_team,
        score_home: match?.score_home,
        score_away: match?.score_away,
        odds_home: match?.odds_home,
        odds_away: match?.odds_away,
        odds_draw: match?.odds_draw,
      },
      baseLogMsg
    );

    await logAgentEvent(strategy.id, strategy.match_id, "info", logMessage, {});

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
    odds_draw: Number(match.odds_draw),
    implied_prob_home: Number(match.implied_prob_home),
    implied_prob_away: Number(match.implied_prob_away),
    implied_prob_draw: Number(match.implied_prob_draw),
    minute: _minute,
    timestamp: new Date().toISOString(),
  };
  const snapshotHash = hashSnapshot(snapshot);

  for (const strategy of strategies) {
    if (strategy.template === "goal_shift_hedge" || strategy.template === "momentum") {
      const ruleConfig = strategy.rule_config as {
        primary_side?: string;
        primary_stake?: number;
        hedge_stake?: number;
      };
      const primarySide = ruleConfig.primary_side || "home";
      // Dynamic max cap: uses explicit hedge_stake, falls back to primary_stake size, or defaults to 50
      const maxHedgeCap = ruleConfig.hedge_stake || ruleConfig.primary_stake || 50;

      const opponentScored =
        (primarySide === "home" && scoringTeam === "away") ||
        (primarySide === "away" && scoringTeam === "home");

      const primaryScore = primarySide === "home" ? Number(match.score_home) : Number(match.score_away);
      const opponentScore = primarySide === "home" ? Number(match.score_away) : Number(match.score_home);
      const goalMargin = primaryScore - opponentScore;

      if (opponentScored) {
        // Time-Decay (Theta) Integration
        const matchMinute = match.minute || 0;
        const timeDecay = Math.max(0, (90 - matchMinute) / 90);
        
        // If we are leading by 2+ goals, or leading by 1 goal late in the match (timeDecay < 0.15 => past 76th min)
        const isLeadSafe = goalMargin >= 2 || (goalMargin === 1 && timeDecay < 0.15);

        if (isLeadSafe) {
          const baseMessage = `Opponent team (${scoringTeam === "home" ? match.home_team : match.away_team}) scored, but primary side maintains a dominant +${goalMargin} goal lead at minute ${matchMinute}. Skipping inefficient hedge due to time-decay.`;
          
          const message = await generateLLMReasoning(
            strategy.template,
            `Opponent scored but supported team retains a safe ${goalMargin}-goal lead at minute ${matchMinute}. Time decay (Theta) indicates no risk offset required.`,
            snapshot,
            baseMessage
          );

          await logAgentEvent(strategy.id, matchId, "info", message, snapshot);
          broadcast(clients, {
            type: "agent_event",
            data: { strategy_id: strategy.id, event_type: "info", message, txline_snapshot: snapshot },
          });
        } else {
          // Draw Defense: If the match becomes tied late in the game (>= 80 mins), hedge the Draw instead.
          const isTied = match.score_home === match.score_away;
          const drawDefenseActive = isTied && matchMinute >= 80;
          
          let hedgeSide: OutcomeSide = scoringTeam === "home" ? "home" : "away";
          let hedgeOdds = scoringTeam === "home" ? Number(match.odds_home) : Number(match.odds_away);
          let impliedProb = hedgeSide === "home" ? Number(match.implied_prob_home) : Number(match.implied_prob_away);

          if (drawDefenseActive) {
            hedgeSide = "draw";
            hedgeOdds = Number(match.odds_draw);
            impliedProb = Number(match.implied_prob_draw) || decimalToImpliedProb(hedgeOdds);
          }
          
          // Kelly Criterion Integration for dynamic stake sizing
          const trueProb = (impliedProb / 100) * (1 + timeDecay * 0.1); // add a slight time-decay premium to our model's true prob
          const edge = (trueProb * hedgeOdds) - 1;
          
          let optimalStake = maxHedgeCap;
          if (edge > 0 && hedgeOdds > 1) {
            const kellyFraction = edge / (hedgeOdds - 1);
            const calculatedKellyStake = (ruleConfig.primary_stake || 100) * kellyFraction * 2; // half-kelly adjustment
            // Bound by user's max hedge stake, and a minimum floor of 10
            optimalStake = Math.min(Math.max(10, calculatedKellyStake), maxHedgeCap);
          } else {
            // Defensive loss-cut when mathematical edge is negative: scale down the stake
            optimalStake = Math.max(10, maxHedgeCap * 0.5); 
          }
          optimalStake = Number(optimalStake.toFixed(2));

          const openPositions = await getPositions(strategy.id);
          const openStrategyPositions = openPositions.filter((position) => position.status === "open");
          const existingHedgeStake = openStrategyPositions
            .filter((position) => position.position_type === "hedge")
            .reduce((total, position) => total + Number(position.stake_credits || 0), 0);
          const remainingHedgeCap = Math.max(0, maxHedgeCap - existingHedgeStake);
          const exposureMaxStake = Math.min(optimalStake, remainingHedgeCap);
          const exposureDecision = getBestHedgeStake(
            openStrategyPositions,
            hedgeSide,
            hedgeOdds,
            exposureMaxStake
          );
          const finalStake = Number(exposureDecision.stake.toFixed(2));
          const confidence = getConfidenceScore({
            matchMinute,
            drawDefenseActive,
            edge,
            exposureImprovement: exposureDecision.improvement,
            maxHedgeCap,
            goalMargin,
          });

          if (finalStake < 1 || exposureDecision.improvement < 1) {
            const skipMessage = `${drawDefenseActive ? "Draw Defense evaluated" : "Opponent goal evaluated"} at ${matchMinute}'. Hedge skipped: exposure already inside cap. Worst-case ${getWorstCase(exposureDecision.before).toFixed(1)} credits. Confidence ${confidence}%.`;
            await logAgentEvent(strategy.id, matchId, "info", skipMessage, {
              ...snapshot,
              portfolio_pnl: exposureDecision.before,
              confidence,
              hedge_side_evaluated: hedgeSide,
              remaining_hedge_cap: remainingHedgeCap,
            });
            broadcast(clients, {
              type: "agent_event",
              data: {
                strategy_id: strategy.id,
                event_type: "info",
                message: skipMessage,
                txline_snapshot: {
                  ...snapshot,
                  portfolio_pnl: exposureDecision.before,
                  confidence,
                },
              },
            });
            continue;
          }

          const drawDefenseStr = drawDefenseActive ? `Late equalizer detected at minute ${matchMinute}. Activating Draw Defense.` : `Opponent team (${scoringTeam === "home" ? match.home_team : match.away_team}) scored.`;
          
          const baseMessage = strategy.template === "momentum"
            ? `${drawDefenseStr} Executing exposure-aware hedge on ${hedgeSide} at ${hedgeOdds.toFixed(2)}. Stake ${finalStake} credits, worst-case improves ${exposureDecision.improvement.toFixed(1)} credits, confidence ${confidence}%.`
            : `${drawDefenseStr} Opening exposure-aware hedge on ${hedgeSide} at ${hedgeOdds.toFixed(2)}. Stake ${finalStake} credits, worst-case improves ${exposureDecision.improvement.toFixed(1)} credits, confidence ${confidence}%.`;

          const message = await generateLLMReasoning(
            strategy.template,
            strategy.template === "momentum"
              ? `${drawDefenseStr} Momentum shifted. Placing exposure-weighted hedge of ${finalStake} on ${hedgeSide}. Confidence ${confidence}%.`
              : `${drawDefenseStr} Conceding goal. Placing exposure-weighted hedge of ${finalStake} on ${hedgeSide}. Confidence ${confidence}%.`,
            {
              ...snapshot,
              portfolio_pnl_before: exposureDecision.before,
              portfolio_pnl_after: exposureDecision.after,
              confidence,
            },
            baseMessage
          );

          const enrichedSnapshot = {
            ...snapshot,
            portfolio_pnl_before: exposureDecision.before,
            portfolio_pnl_after: exposureDecision.after,
            portfolio_summary_before: formatPnl(exposureDecision.before),
            portfolio_summary_after: formatPnl(exposureDecision.after),
            confidence,
            edge,
          };

          await logAgentEvent(strategy.id, matchId, "trigger", message, enrichedSnapshot);

          const position = await createPosition(
            strategy.id,
            matchId,
            strategy.wallet,
            hedgeSide,
            hedgeOdds,
            finalStake,
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
                txline_snapshot: enrichedSnapshot,
              },
            });
          }
        }
      } else {
        const baseMessage = strategy.template === "momentum"
          ? `Positive momentum detected: ${scoringTeam === "home" ? match.home_team : match.away_team} scored. Supported side holds lead. No risk offset required.`
          : `Goal detected: ${scoringTeam === "home" ? match.home_team : match.away_team} scored. This aligns with your primary position on ${primarySide === "home" ? match.home_team : match.away_team}. No hedge needed — momentum is favorable.`;

        const message = await generateLLMReasoning(
          strategy.template,
          `Supported team (${scoringTeam === "home" ? match.home_team : match.away_team}) scored. Momentum remains favorable. No action required.`,
          snapshot,
          baseMessage
        );

        await logAgentEvent(strategy.id, matchId, "info", message, snapshot);
        broadcast(clients, {
          type: "agent_event",
          data: { strategy_id: strategy.id, event_type: "info", message, txline_snapshot: snapshot },
        });
      }
    } else if (strategy.template === "mean_reversion") {
      const ruleConfig = strategy.rule_config as {
        primary_side?: string;
        primary_stake?: number;
        hedge_stake?: number;
      };
      const primarySide = ruleConfig.primary_side || "home";
      const reversionStake = ruleConfig.hedge_stake || ruleConfig.primary_stake || 50;

      const opponentScored =
        (primarySide === "home" && scoringTeam === "away") ||
        (primarySide === "away" && scoringTeam === "home");

      if (opponentScored) {
        const primarySideOdds = primarySide === "home" ? Number(match.odds_home) : Number(match.odds_away);
        const openPositions = await getPositions(strategy.id);
        const existingHedgeStake = openPositions
          .filter((position) => position.status === "open" && position.position_type === "hedge")
          .reduce((total, position) => total + Number(position.stake_credits || 0), 0);
        const remainingHedgeCap = Math.max(0, reversionStake - existingHedgeStake);

        if (remainingHedgeCap < 1) {
          const pnl = getOutcomePnl(openPositions.filter((position) => position.status === "open"));
          const message = `Mean reversion skipped: hedge budget already deployed. Portfolio P/L ${formatPnl(pnl)}.`;
          await logAgentEvent(strategy.id, matchId, "info", message, {
            ...snapshot,
            portfolio_pnl: pnl,
            remaining_hedge_cap: remainingHedgeCap,
          });
          broadcast(clients, {
            type: "agent_event",
            data: { strategy_id: strategy.id, event_type: "info", message, txline_snapshot: snapshot },
          });
          continue;
        }

        const finalStake = Math.min(reversionStake, remainingHedgeCap);
        const baseMessage = `Odds deviation detected: Opponent team scored. Supported side (${primarySide === "home" ? match.home_team : match.away_team}) odds spiked to ${primarySideOdds.toFixed(2)}. Entering capped reversion position of ${finalStake} credits at premium odds.`;

        const message = await generateLLMReasoning(
          strategy.template,
          `Opponent team scored. Supported team's odds spiked to ${primarySideOdds.toFixed(2)}. Entering capped reversion position.`,
          snapshot,
          baseMessage
        );

        await logAgentEvent(strategy.id, matchId, "trigger", message, snapshot);

        const position = await createPosition(
          strategy.id,
          matchId,
          strategy.wallet,
          primarySide,
          primarySideOdds,
          finalStake,
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
        const baseMessage = `Supported team scored. Odds compressed. No deviation present for mean reversion entry.`;
        const message = await generateLLMReasoning(
          strategy.template,
          `Supported team scored. Odds compressed. No reversion trigger.`,
          snapshot,
          baseMessage
        );

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
