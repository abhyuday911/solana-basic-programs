import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Escrow } from "../target/types/escrow";
import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY, Keypair } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, MINT_SIZE, createMint, createAccount, mintTo } from "@solana/spl-token";
const { assert } = require("chai");

describe("escrow", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Escrow as Program<Escrow>;
  
  let mint: PublicKey;
  let initializerTokenAccount: PublicKey;
  let receiverTokenAccount: PublicKey;
  let escrowKeypair: Keypair;
  let vaultAuthority: PublicKey;
  let vault: PublicKey;
  let receiver: Keypair;

  const escrowAmount = new anchor.BN(100000000); // 100 tokens

  before(async () => {
    // Create mint
    mint = await createMint(
      provider.connection,
      (provider.wallet as any).payer,
      provider.publicKey,
      null,
      6
    );

    // Create initializer's token account
    initializerTokenAccount = await createAccount(
      provider.connection,
      (provider.wallet as any).payer,
      mint,
      provider.publicKey
    );

    // Create receiver's keypair and token account
    receiver = anchor.web3.Keypair.generate();
    await provider.sendAndConfirm(
      new anchor.web3.Transaction().add(
        SystemProgram.createAccount({
          fromPubkey: provider.publicKey,
          newAccountPubkey: receiver.publicKey,
          space: 0,
          lamports: await provider.connection.getMinimumBalanceForRentExemption(0),
          programId: SystemProgram.programId,
        })
      ),
      [receiver]
    );

    receiverTokenAccount = await createAccount(
      provider.connection,
      (provider.wallet as any).payer,
      mint,
      receiver.publicKey
    );

    // Mint tokens to initializer
    await mintTo(
      provider.connection,
      (provider.wallet as any).payer,
      mint,
      initializerTokenAccount,
      provider.publicKey,
      1000000000 // 1000 tokens
    );

    // Generate escrow keypair
    escrowKeypair = anchor.web3.Keypair.generate();

    // Derive PDA for vault authority
    [vaultAuthority] = await PublicKey.findProgramAddress(
      [Buffer.from("vault"), escrowKeypair.publicKey.toBuffer()],
      program.programId
    );

    // Derive vault token account
    vault = await anchor.utils.token.associatedAddress({
      mint: mint,
      owner: vaultAuthority
    });
  });

  it("Initializes escrow", async () => {
    try {
      await program.methods
        .initializeEscrow(escrowAmount, receiver.publicKey)
        .accounts({
          escrow: escrowKeypair.publicKey,
          initializer: provider.publicKey,
          initializerTokenAccount: initializerTokenAccount,
          vaultAuthority: vaultAuthority,
          vault: vault,
          mint: mint,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .signers([escrowKeypair])
        .rpc();

      // Verify escrow state
      const escrowAccount = await program.account.escrow.fetch(escrowKeypair.publicKey);
      assert.ok(escrowAccount.initializer.equals(provider.publicKey));
      assert.ok(escrowAccount.reciever.equals(receiver.publicKey));
      assert.ok(escrowAccount.mint.equals(mint));
      assert.equal(escrowAccount.amount.toString(), escrowAmount.toString());

      // Verify tokens were transferred to vault
      const vaultBalance = await provider.connection.getTokenAccountBalance(vault);
      assert.equal(vaultBalance.value.amount, escrowAmount.toString());
      
    } catch (err) {
      console.error("Error:", err);
      throw err;
    }
  });

  it("Claims escrow", async () => {
    // Get initial balances
    const initialReceiverBalance = await provider.connection.getTokenAccountBalance(receiverTokenAccount);
    const initialVaultBalance = await provider.connection.getTokenAccountBalance(vault);

    await program.methods
      .claimEscrow()
      .accounts({
        escrow: escrowKeypair.publicKey,
        vaultAuthority: vaultAuthority,
        vault: vault,
        reciever: receiver.publicKey,
        receiverTokenAccount: receiverTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([receiver])
      .rpc();

    // Verify balances after claim
    const finalReceiverBalance = await provider.connection.getTokenAccountBalance(receiverTokenAccount);
    const finalVaultBalance = await provider.connection.getTokenAccountBalance(vault);

    assert.equal(
      finalReceiverBalance.value.amount,
      (BigInt(initialReceiverBalance.value.amount) + BigInt(escrowAmount.toString())).toString()
    );
    assert.equal(
      finalVaultBalance.value.amount,
      (BigInt(initialVaultBalance.value.amount) - BigInt(escrowAmount.toString())).toString()
    );
  });
});
