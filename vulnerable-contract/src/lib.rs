use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod vulnerable_contract {
    use super::*;

    /// VULN 1: No authority check — anyone can initialize and claim ownership
    pub fn initialize(ctx: Context<Initialize>, amount: u64) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        vault.authority = ctx.accounts.payer.key();
        vault.balance   = amount;
        Ok(())
    }

    /// VULN 2: Missing signer check — user field is AccountInfo, not Signer
    /// VULN 3: Missing owner check — authority is never verified against user
    /// VULN 4: Unchecked arithmetic — subtraction can underflow
    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        // Intentionally missing: require!(vault.authority == ctx.accounts.user.key(), ErrorCode::Unauthorized);
        vault.balance = vault.balance - amount; // underflow if amount > balance
        Ok(())
    }

    /// VULN 5: Unchecked arithmetic — addition can overflow
    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        vault.balance = vault.balance + amount; // overflow if balance near u64::MAX
        Ok(())
    }

    /// VULN 6: Arbitrary CPI — target program is not validated before invoking
    pub fn cpi_transfer(ctx: Context<CpiTransfer>, amount: u64) -> Result<()> {
        let ix = anchor_lang::solana_program::system_instruction::transfer(
            ctx.accounts.from.key,
            ctx.accounts.to.key,
            amount,
        );
        anchor_lang::solana_program::program::invoke(
            &ix,
            &[
                ctx.accounts.from.to_account_info(),
                ctx.accounts.to.to_account_info(),
            ],
        )?;
        Ok(())
    }
}

// ── Account structs ────────────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = payer, space = 8 + 40)]
    pub vault: Account<'info, Vault>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

/// VULN: user is AccountInfo, not Signer — signer check is absent
#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub vault: Account<'info, Vault>,
    /// CHECK: intentionally unchecked — demonstrates missing signer/owner constraint
    pub user: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub vault: Account<'info, Vault>,
    #[account(mut)]
    pub payer: Signer<'info>,
}

/// VULN: from/to are unchecked AccountInfo — no program or owner validation
#[derive(Accounts)]
pub struct CpiTransfer<'info> {
    /// CHECK: unchecked source account
    #[account(mut)]
    pub from: AccountInfo<'info>,
    /// CHECK: unchecked destination account
    #[account(mut)]
    pub to: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

// ── State ──────────────────────────────────────────────────────────────────────

#[account]
pub struct Vault {
    pub authority: Pubkey,
    pub balance:   u64,
}
