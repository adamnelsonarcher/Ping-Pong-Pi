// settings.js

// Timer for player dropdown reset after game end, in minutes.
export const TIMER_INTERVAL = 5; // 5 minutes, adjust as needed

// SCORE SETTINGS
// the k factor is the most points that can be won or lost in a game
export const SCORE_CHANGE_K_FACTOR = 70;

// the point difference weight is a value that multiplies the point difference at the end game, and
// adds that value to k
export const POINT_DIFFERENCE_WEIGHT = 6;

// the number of games a person needs to play to become ranked
export const ACTIVITY_THRESHOLD = 3;

// the default name/display for a person's points while they are unranked
export const DEFAULT_RANK = "Unranked";

// DISPLAY SETTINGS
export const PLAYER1_SCOREBOARD_COLOR = '#4CAF50';
export const PLAYER2_SCOREBOARD_COLOR = '#2196F3';

// this is how many games to keep stored in the history
export const GAME_HISTORY_KEEP = 30;

// password for deleting players and resetting scores
export const ADMIN_PASSWORD = '613668';

// this determines if anyone can create a new player, or if the admin needs to do it
export const ADDPLAYER_ADMINONLY = false;

const settings = {
  TIMER_INTERVAL,
  SCORE_CHANGE_K_FACTOR,
  POINT_DIFFERENCE_WEIGHT,
  ACTIVITY_THRESHOLD,
  DEFAULT_RANK,
  PLAYER1_SCOREBOARD_COLOR,
  PLAYER2_SCOREBOARD_COLOR,
  GAME_HISTORY_KEEP,
  ADDPLAYER_ADMINONLY
};

export default settings;
