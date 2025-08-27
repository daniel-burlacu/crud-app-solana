use anchor_lang::prelude::*;

#[error_code]
pub enum CrudError {
    #[msg("Title is immutable because it is part of the address seed.")]
    TitleImmutable,
}