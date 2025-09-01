use anchor_lang::prelude::*;
use crate::context::UpdateJournalEntry;
use crate::errors::CrudError;
use crate::entity::JournalEntryState;

pub fn handler(
    ctx: Context<UpdateJournalEntry>,
    title: String,      // used for PDA derivation; do NOT change stored title
    message: String,
) -> Result<()> {
    let state: &mut Account<JournalEntryState> = &mut ctx.accounts.journal_entry_state;

    // Enforce title immutability since it's part of the PDA seed.
    // (Optional but recommended, avoids future lookups desync.)
    require!(state.title == title, CrudError::TitleImmutable);

    state.message = message;
    Ok(())
}
