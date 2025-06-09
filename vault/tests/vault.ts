import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Vault } from "../target/types/vault";
import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY, Keypair } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, MINT_SIZE, createMint, createAccount, mintTo, createTransferCheckedInstruction } from "@solana/spl-token";
const { assert } = require("chai");

describe("vault", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Vault as Program<Vault>;
  
  let usdcMint: PublicKey;
  let userTokenAccount: PublicKey;
  let vaultKeypair: Keypair;
  let vault: PublicKey;
  let vaultTokenAccount: PublicKey;
  let vaultAuthority: PublicKey;
  let vaultBump: number;

  before(async () => {
    // Create USDC mint
    usdcMint = await createMint(
      provider.connection,
      (provider.wallet as any).payer,
      provider.publicKey,
      null,
      6
    );

    // Create user's token account
    userTokenAccount = await createAccount(
      provider.connection,
      (provider.wallet as any).payer,
      usdcMint,
      provider.publicKey
    );

    // Mint some tokens to user
    await mintTo(
      provider.connection,
      (provider.wallet as any).payer,
      usdcMint,
      userTokenAccount,
      provider.publicKey,
      1000000000 // 1000 USDC
    );

    // Generate vault keypair
    vaultKeypair = anchor.web3.Keypair.generate();
    vault = vaultKeypair.publicKey;

    // Derive PDA for vault authority
    [vaultAuthority, vaultBump] = await PublicKey.findProgramAddress(
      [Buffer.from("vault_authority"), vault.toBuffer()],
      program.programId
    );

    // Derive vault token account
    vaultTokenAccount = await anchor.utils.token.associatedAddress({
      mint: usdcMint,
      owner: vaultAuthority
    });
  });

  it("Initializes the vault", async () => {
    try {
      await program.methods
        .initializeVault()
        .accounts({
          vault: vaultKeypair.publicKey,
          vaultAuthority: vaultAuthority,
          vaultTokenAccount: vaultTokenAccount,
          payer: provider.publicKey,
          usdcMint: usdcMint,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .signers([vaultKeypair])
        .rpc();

      // Verify vault data
      const vaultData = await program.account.vault.fetch(vault);
      assert.ok(vaultData.authority.equals(vaultAuthority));
      assert.equal(vaultData.bump, vaultBump);
      console.log(vaultData)
      
    } catch (err) {
      console.error("Error:", err);
      throw err;
    }
  });

  it("Can withdraw from vault", async () => {
    const withdrawAmount = new anchor.BN(100000000); // 100 USDC

    // First deposit some tokens to vault
    await provider.sendAndConfirm(
      new anchor.web3.Transaction().add(
        createTransferCheckedInstruction(
          userTokenAccount,
          usdcMint,
          vaultTokenAccount,
          provider.publicKey,
          withdrawAmount.toNumber(),
          6 // decimals
        )
      )
    );

    // Get initial balances
    const initialUserBalance = await provider.connection.getTokenAccountBalance(userTokenAccount);
    const initialVaultBalance = await provider.connection.getTokenAccountBalance(vaultTokenAccount);

    // Perform withdrawal
    await program.methods
      .withdrawFromVault(withdrawAmount)
      .accounts({
        vault: vault,
        vaultAuthority: vaultAuthority,
        vaultTokenAccount: vaultTokenAccount,
        recipientTokenAccount: userTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    // Verify balances after withdrawal
    const finalUserBalance = await provider.connection.getTokenAccountBalance(userTokenAccount);
    const finalVaultBalance = await provider.connection.getTokenAccountBalance(vaultTokenAccount);

    assert.equal(
      finalUserBalance.value.amount,
      (BigInt(initialUserBalance.value.amount) + BigInt(withdrawAmount.toString())).toString()
    );
    assert.equal(
      finalVaultBalance.value.amount,
      (BigInt(initialVaultBalance.value.amount) - BigInt(withdrawAmount.toString())).toString()
    );
    console.log(initialUserBalance, initialVaultBalance, finalVaultBalance, finalUserBalance)
  });
});
