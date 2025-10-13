use anchor_lang::prelude::*;

#[error_code]
pub enum EscrowError {
    #[msg("Escrow already initialized")]
    EscrowAlreadyInitialized,

    #[msg("Escrow not initialized")]
    EscrowNotInitialized,

    #[msg("Missing vault bump")]
    MissingVaultBump,
}