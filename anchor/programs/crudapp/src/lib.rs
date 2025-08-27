#![allow(unexpected_cfgs)]
#![allow(clippy::result_large_err)]
#![allow(clippy::too_many_arguments)]

use anchor_lang::prelude::*;

pub mod constants;
pub mod errors;
pub mod entity;
pub mod context;
pub mod instructions;

pub use context::*;
pub use entity::*;

declare_id!("2wtMCx1PDGqCHfCYnfKrhQRrANFWeMxNSr7eAPJrhrmv");

#[program]
pub mod crudapp {
    use super::*;

    pub fn create_journal_entry(
        ctx: Context<CreateJournalEntry>,
        title: String,
        message: String,
    ) -> Result<()> {
        instructions::create_journal_entry::handler(ctx, title, message)
    }

    // NOTE: title is part of the PDA seeds (see accounts). That makes it effectively
    // immutable. We keep it as a parameter because the seeds use it to find the PDA.
    pub fn update_journal_entry(
        ctx: Context<UpdateJournalEntry>,
        title: String,
        message: String,
    ) -> Result<()> {
        instructions::update_journal_entry::handler(ctx, title, message)
    }

    pub fn delete_journal_entry(
        ctx: Context<DeleteJournalEntry>,
        title: String,
    ) -> Result<()> {
        instructions::delete_journal_entry::handler(ctx, title)
    }
}
