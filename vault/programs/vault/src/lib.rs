use anchor_lang::prelude::*;
use anchor_spl::token::{Transfer as TokenTransfer, Token, TokenAccount, Mint, transfer};
use anchor_spl::associated_token::AssociatedToken;

declare_id!("AFM9DUEVAuRp2VyWXeqAXbp7xrmQSVTd5JGpCEMHHLCi");

#[program]
pub mod vault {
    use super::*;

    pub fn initialize_vault(ctx: Context<InitializeVault>) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        let authority = ctx.accounts.vault_authority.key();
        vault.authority = authority;

        let (_pda, bump) = Pubkey::find_program_address(&[b"vault_authority", vault.key().as_ref()], ctx.program_id);

        vault.bump = bump;

        Ok(())
    }

    pub fn withdraw_from_vault(ctx: Context<WithdrawFromVault>, amount: u64) -> Result<()> {
        let vault_key = ctx.accounts.vault.key();
        let signer_seeds = &[
            b"vault_authority",
            vault_key.as_ref(),
            &[ctx.accounts.vault.bump]
        ];

        transfer(
            CpiContext::new_with_signer(ctx.accounts.token_program.to_account_info(), TokenTransfer {
                from: ctx.accounts.vault_token_account.to_account_info(),
                to: ctx.accounts.recipient_token_account.to_account_info(),
                authority: ctx.accounts.vault_authority.to_account_info()
            }, &[signer_seeds]),
            amount
        )?;

        Ok(())
    }
}

#[account]
pub struct Vault {
    pub authority: Pubkey,
    pub bump: u8
}

#[derive(Accounts)]
pub struct InitializeVault<'info> {
    #[account(init, payer = payer, space = 8 +  32 + 1)]
    pub vault: Account<'info, Vault>,

    #[account(
        seeds = [b"vault_authority", vault.key().as_ref()],
        bump
    )]
    ///CHECK: Safe - Used as PDA signer
    pub vault_authority: UncheckedAccount<'info>,

    #[account(
        init, 
        payer = payer,
        associated_token::mint = usdc_mint,
        associated_token::authority = vault_authority
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub usdc_mint: Account<'info, Mint>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>
}

#[derive(Accounts)]
pub struct WithdrawFromVault<'info> {
    #[account(mut)]
    pub vault: Account<'info, Vault>,

    #[account(mut, seeds= [b"vault_authority", vault.key().as_ref()], bump)]
    ///CHECK: PDA Signer
    pub vault_authority: UncheckedAccount<'info>,
    
    #[account(mut)]
    pub vault_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub recipient_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>
}
