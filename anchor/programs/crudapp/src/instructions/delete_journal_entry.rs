use anchor_lang::prelude::*;
use crate::context::DeleteJournalEntry;

pub fn handler(
    _ctx: Context<DeleteJournalEntry>,
    _title: String,
) -> Result<()> {
    // Account is closed by the `close = owner` constraint.
    Ok(())
}
