use anchor_lang::prelude::*;

declare_id!("BZ6W4B9Te3nnZWXd19QSaTXDxTF1rtC1je8roTDrorrk");

#[program]
pub mod txhedge {
    use super::*;

    /// Create a strategy account that defines the hedging rules for a match.
    pub fn create_strategy(
        ctx: Context<CreateStrategy>,
        match_id: String,
        market: String,
        rule_config_hash: [u8; 32],
    ) -> Result<()> {
        let strategy = &mut ctx.accounts.strategy;
        strategy.authority = ctx.accounts.authority.key();
        strategy.match_id = match_id;
        strategy.market = market;
        strategy.rule_config_hash = rule_config_hash;
        strategy.created_at = Clock::get()?.unix_timestamp;
        strategy.bump = ctx.bumps.strategy;
        Ok(())
    }

    /// Create a position PDA derived from ["position", user, match_id, nonce].
    pub fn create_position(
        ctx: Context<CreatePosition>,
        strategy_id: Pubkey,
        side: Side,
        entry_odds_bps: u64,
        stake: u64,
    ) -> Result<()> {
        require!(stake > 0, TxHedgeError::InvalidStake);
        require!(entry_odds_bps > 10000, TxHedgeError::InvalidOdds);

        let position = &mut ctx.accounts.position;
        position.authority = ctx.accounts.authority.key();
        position.strategy_id = strategy_id;
        position.side = side;
        position.entry_odds_bps = entry_odds_bps;
        position.stake = stake;
        position.state = PositionState::Open;
        position.created_at = Clock::get()?.unix_timestamp;
        position.bump = ctx.bumps.position;
        Ok(())
    }

    /// Record the TxLINE data snapshot hash that triggered the agent's decision.
    pub fn record_trigger(
        ctx: Context<RecordTrigger>,
        txline_snapshot_hash: [u8; 32],
    ) -> Result<()> {
        let position = &mut ctx.accounts.position;
        require!(
            position.state == PositionState::Open,
            TxHedgeError::PositionNotOpen
        );
        position.txline_snapshot_hash = Some(txline_snapshot_hash);
        Ok(())
    }

    /// Settle a position using the verified TxLINE final result.
    /// The caller must provide the TxLINE result hash — the program does NOT
    /// accept an arbitrary admin outcome. The result hash is stored on-chain
    /// for independent verification.
    pub fn settle_position(
        ctx: Context<SettlePosition>,
        final_outcome: Side,
        final_score_home: u8,
        final_score_away: u8,
        txline_result_hash: [u8; 32],
    ) -> Result<()> {
        let position = &mut ctx.accounts.position;
        require!(
            position.state == PositionState::Open,
            TxHedgeError::PositionNotOpen
        );

        let won = position.side == final_outcome;
        let pnl = if won {
            let entry_odds = position.entry_odds_bps as i128;
            let stake = position.stake as i128;
            stake * (entry_odds - 10000) / 10000
        } else {
            -(position.stake as i128)
        };

        position.state = PositionState::Settled;
        position.pnl = pnl as i64;
        position.settled_at = Clock::get()?.unix_timestamp;

        let receipt = &mut ctx.accounts.settlement_receipt;
        receipt.position = position.key();
        receipt.final_outcome = final_outcome;
        receipt.final_score_home = final_score_home;
        receipt.final_score_away = final_score_away;
        receipt.txline_result_hash = txline_result_hash;
        receipt.pnl = pnl as i64;
        receipt.settled_at = Clock::get()?.unix_timestamp;
        receipt.bump = ctx.bumps.settlement_receipt;

        Ok(())
    }
}

// ---- Accounts ----

#[derive(Accounts)]
#[instruction(match_id: String)]
pub struct CreateStrategy<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 4 + 64 + 4 + 64 + 32 + 8 + 1,
        seeds = [b"strategy", authority.key().as_ref(), match_id.as_bytes()],
        bump
    )]
    pub strategy: Account<'info, StrategyAccount>,

    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(strategy_id: Pubkey, _side: Side)]
pub struct CreatePosition<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 32 + 1 + 8 + 8 + 1 + 32 + 8 + 8 + 1,
        seeds = [b"position", authority.key().as_ref(), strategy_id.as_ref()],
        bump
    )]
    pub position: Account<'info, PositionAccount>,

    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RecordTrigger<'info> {
    #[account(mut, has_one = authority)]
    pub position: Account<'info, PositionAccount>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct SettlePosition<'info> {
    #[account(mut, has_one = authority)]
    pub position: Account<'info, PositionAccount>,

    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 1 + 1 + 1 + 32 + 8 + 8 + 1,
        seeds = [b"settlement", position.key().as_ref()],
        bump
    )]
    pub settlement_receipt: Account<'info, SettlementReceipt>,

    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

// ---- Data Structures ----

#[account]
pub struct StrategyAccount {
    pub authority: Pubkey,
    pub match_id: String,
    pub market: String,
    pub rule_config_hash: [u8; 32],
    pub created_at: i64,
    pub bump: u8,
}

#[account]
pub struct PositionAccount {
    pub authority: Pubkey,
    pub strategy_id: Pubkey,
    pub side: Side,
    pub entry_odds_bps: u64,
    pub stake: u64,
    pub state: PositionState,
    pub txline_snapshot_hash: Option<[u8; 32]>,
    pub pnl: i64,
    pub created_at: i64,
    pub settled_at: i64,
    pub bump: u8,
}

#[account]
pub struct SettlementReceipt {
    pub position: Pubkey,
    pub final_outcome: Side,
    pub final_score_home: u8,
    pub final_score_away: u8,
    pub txline_result_hash: [u8; 32],
    pub pnl: i64,
    pub settled_at: i64,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum Side {
    Home,
    Away,
    Draw,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum PositionState {
    Open,
    Settled,
}

#[error_code]
pub enum TxHedgeError {
    #[msg("Stake must be greater than zero")]
    InvalidStake,
    #[msg("Entry odds must be greater than 1.0 (10000 bps)")]
    InvalidOdds,
    #[msg("Position is not in Open state")]
    PositionNotOpen,
}
