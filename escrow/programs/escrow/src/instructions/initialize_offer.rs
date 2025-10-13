use anchor_lang::prelude::*;

use crate::states::Escrow;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{transfer, Mint, Token, TokenAccount, Transfer as TokenTransfer},
};

#[derive(Accounts)]

pub struct InitializeEscrow<'info> {
    #[account(
        init,
        payer = initializer,
        space = 8 + 32 + 32 + 32 + 8 + 1
    )]
    pub escrow: Account<'info, Escrow>,

    #[account(mut)]
    pub initializer: Signer<'info>,

    #[account(mut)]
    pub initializer_token_account: Account<'info, TokenAccount>,

    #[account(
        seeds = [b"vault", escrow.key().as_ref()],
        bump
    )]
    /// CHECK: PDA Signer
    pub vault_authority: UncheckedAccount<'info>,

    #[account(
        init,
        payer = initializer,
        associated_token::mint = mint,
        associated_token::authority = vault_authority
    )]
    pub vault: Account<'info, TokenAccount>,

    ///Token being escrowed
    pub mint: Account<'info, Mint>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn initialize_escrow(
    ctx: Context<InitializeEscrow>,
    amount: u64,
    reciever: Pubkey,
) -> Result<()> {
    let escrow = &mut ctx.accounts.escrow;
    escrow.initializer = ctx.accounts.initializer.key();
    escrow.receiver = reciever;
    escrow.mint = ctx.accounts.mint.key();
    escrow.amount = amount;
    escrow.bump = ctx.bumps.vault_authority;

    let cpi_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        TokenTransfer {
            from: ctx.accounts.initializer_token_account.to_account_info(),
            to: ctx.accounts.vault.to_account_info(),
            authority: ctx.accounts.initializer.to_account_info(),
        },
    );

    let _ = transfer(cpi_ctx, amount);

    Ok(())
}
