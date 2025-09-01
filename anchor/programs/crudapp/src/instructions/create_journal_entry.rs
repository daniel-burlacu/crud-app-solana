use anchor_lang::prelude::*;
use crate::context::CreateJournalEntry;
use crate::entity::JournalEntryState;

pub fn handler(
    ctx: Context<CreateJournalEntry>,
    title: String,
    message: String,
) -> Result<()> {
    let state: &mut Account<JournalEntryState> = &mut ctx.accounts.journal_entry_state;
    state.owner = ctx.accounts.owner.key();
    state.title = title;
    state.message = message;
    Ok(())
}
