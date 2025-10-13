use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount, Transfer as TokenTransfer, transfer};

pub use crate::states::Escrow;

#[derive(Accounts)]
pub struct ClaimEscrow<'info> {
    #[account(mut, has_one = receiver)]
    pub escrow: Account<'info, Escrow>,

    #[account(
        seeds = [b"vault", escrow.key().as_ref()],
        bump = escrow.bump
    )]
    /// CHECK: PDA Signer
    pub vault_authority: UncheckedAccount<'info>,

    #[account(mut)]
    pub vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub receiver: Signer<'info>,

    #[account(mut)]
    pub receiver_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

pub fn claim_escrow(ctx: Context<ClaimEscrow>) -> Result<()> {
    let escrow_key = ctx.accounts.escrow.key();
    let bump = ctx.accounts.escrow.bump;
    let seeds = &[b"vault", escrow_key.as_ref(), &[bump]];
    let signer = &[&seeds[..]];

    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        TokenTransfer {
            from: ctx.accounts.vault.to_account_info(),
            to: ctx.accounts.receiver_token_account.to_account_info(),
            authority: ctx.accounts.vault_authority.to_account_info(),
        },
        signer,
    );

    let _ = transfer(cpi_ctx, ctx.accounts.escrow.amount);

    Ok(())
}
