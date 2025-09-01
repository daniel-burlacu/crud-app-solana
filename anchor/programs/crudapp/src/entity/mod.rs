use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct JournalEntryState {
    #[max_len(50)]
    pub title: String,
    #[max_len(1000)]
    pub message: String,
    pub owner: Pubkey,
}
