// Features that can be switched off for a release.
// The Claude writing features are off for now: build with VITE_AI=1 to turn them on
// (the AI end-to-end test does this).
export const AI_ENABLED = import.meta.env.VITE_AI === '1'
