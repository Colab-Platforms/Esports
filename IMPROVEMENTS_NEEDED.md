# CS2 Tournament Join - Improvements Needed

## Current User Journey Issues

### 1. Steam Linking UX (HIGH PRIORITY)
**Current:** Alert dialog with technical text
**Problem:** Confusing, not user-friendly
**Solution:** Create SteamLinkingModal component

### 2. Steam ID Verification (HIGH PRIORITY)
**Current:** No verification after linking
**Problem:** User might link wrong account
**Solution:** Show Steam profile preview + confirmation

### 3. Registration Modal - Auto-fill Steam ID (MEDIUM)
**Current:** Manual input field
**Problem:** Error-prone, user can enter wrong ID
**Solution:** Auto-fill from user.gameIds.steam, make read-only

### 4. Server Details Visibility (MEDIUM)
**Current:** Hidden in General tab, need to scroll
**Problem:** Not easily accessible
**Solution:** Add quick access button or sticky card

### 5. Server Status Indicator (LOW)
**Current:** No status shown
**Problem:** User doesn't know if server is online
**Solution:** Add live status indicator with ping

### 6. Timeline Clarity (MEDIUM)
**Current:** Only registration timer shown
**Problem:** Confusing when tournament actually starts
**Solution:** Show both registration close and tournament start times

### 7. In-Game Instructions (HIGH)
**Current:** Basic instructions only
**Problem:** User doesn't know what to do after joining
**Solution:** Detailed step-by-step in-game guide

## Recommended Implementation Order

1. **Steam Linking Modal** - Better UX for Steam connection
2. **Auto-fill Steam ID** - Prevent registration errors
3. **In-Game Instructions** - Help users understand process
4. **Timeline Clarity** - Reduce confusion
5. **Server Status** - Show server availability
6. **Steam Verification** - Confirm correct account

## Files to Modify

- `client/src/components/tournaments/SteamLinkingModal.js` (NEW)
- `client/src/components/tournaments/TournamentRegistration.js` (UPDATE)
- `client/src/pages/tournaments/SingleTournamentPage.js` (UPDATE)
- `server/routes/steam.js` (UPDATE - add profile fetch)
