# settings.py

# Timer for player dropdown reset after game end, in minutes.
# use values like 0.5 to get a value less than 1 minute
TIMER_INTERVAL = 5


# SCORE SETTINGS
# the k factor is the most points that can be won or lost in a game
# the point difference weight is a value that multiplies the point difference at the end game, and
# adds that value to k
#
# for example: player 1 beats player 2 [21 to 15]. Point difference of 6, multiplied by the weight (6) = 36
# k goes from 70 to 106, making the game worth more points for both parties.
# set point_different_weight to 0 to remove this funcionality
SCORE_CHANGE_K_FACTOR = 70
POINT_DIFFERENCE_WEIGHT = 6


# the number of games a person needs to play to become ranked
ACTIVITY_THRESHOLD = 3
# the default name/display for a person's points while they are unranked
DEFAULT_RANK = "Unranked"


# DISPLAY SETTINGS
PLAYER1_SCOREBOARD_COLOR = r'#4CAF50'
PLAYER2_SCOREBOARD_COLOR = r'#2196F3'

# Path configurations
PLAYER_PATH = r'./game_data/players.txt'
SCORE_HIST_PATH = r'./game_data/score_history.txt'
GAME_HIST_PATH = r'./game_data/game_history.txt'

# Other global constants
# this is how many games to keep stored in the txt history log
GAME_HISTORY_KEEP = 30
# password for deleting players and resetting scores
ADMIN_PASSWORD = '613668'
