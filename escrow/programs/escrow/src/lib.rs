use anchor_lang::prelude::*;

pub mod error;
pub mod instructions;
pub mod states;

pub use error::*;
pub use instructions::*;
pub use states::*;

declare_id!("GcDx5UJ9NPhZeANPUJweZrbNAYpvpzaiJ3JLnLPgM3qr");

#[program]
pub mod escrow {
    use super::*;

    pub fn initialize_offer(
        ctx: Context<InitializeEscrow>,
        amount: u64,
        reciever: Pubkey,
    ) -> Result<()> {
        instructions::initialize_offer::initialize_escrow(ctx, amount, reciever)
    }

    pub fn claim_offer(ctx: Context<ClaimEscrow>) -> Result<()> {
        instructions::claim_offer::claim_escrow(ctx)
    }
}