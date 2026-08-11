/* Deprecated — embedding the logo as a base64 string literal here caused
   Babel's transform to hang (reproduced even with zero plugins/presets, so
   it's a tooling limitation, not a config issue). The real logo for print
   documents is now loaded at runtime from the bundled asset instead — see
   src/logoAsset.js (getLogoDataUri()) and its use in logic.js's
   bgtsLogoImg()/lrHtml()/receiptHtml(). This file is kept as an empty no-op
   rather than deleted (deletion via this session's tooling failed with a
   filesystem permission error) — nothing imports it. */
export {};
