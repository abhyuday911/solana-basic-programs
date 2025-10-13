use anchor_lang::prelude::*;

#[account]
pub struct Escrow {
    pub initializer: Pubkey,
    pub receiver: Pubkey,
    pub mint: Pubkey,
    pub amount: u64,
    pub bump: u8,
}
