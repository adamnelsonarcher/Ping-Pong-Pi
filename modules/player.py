# player.py
import sys
from PyQt5.QtGui import *
from PyQt5.QtWidgets import *
from PyQt5.QtCore import *


class Player:
    def __init__(self, name, score=1000, password=""):
        self.name = name
        self.score = score
        self.games_played = 0
        self.wins = 0
        self.losses = 0
        self.password = password

        # New attributes for lifetime stats
        self.lifetime_games_played = 0
        self.lifetime_wins = 0
        self.lifetime_losses = 0
        self.lifetime_score = score

        self.active = self.games_played >= 3

        self.score_history = [score]

    def update_score(self, opponent, won, point_difference):
        opponent_is_unranked = (not opponent.active)
        player_is_unranked = (not self.active)

        K = 70 + point_difference*6
        # Calculate the K factor based on the point difference
        if player_is_unranked and opponent_is_unranked:
            K = K*1.2 # Both players are unranked, 20% increase in volatility
        elif player_is_unranked:
            K = K*1.2 # 20% increase in volatility for unranked player
        elif opponent_is_unranked:
            K = 20   # The ranked player only gains/loses a maximum of 20 points
        else:
            pass  # Both players are ranked, normal scoring applies

        result = 1 if won else 0
        expected_score = 1 / (1 + 10 ** ((opponent.score - self.score) / 450))
        score_change = K * (result - expected_score)
        if expected_score < 0.45 and result == 1:
            score_change = score_change * 1.3
        self.score += score_change
        self.games_played += 1

        # Update lifetime stats only if the player is active (has played at least 3 games)
        # calculate change in lifetime score seperately from change in current score
        self.lifetime_games_played += 1
        expected_score_lifetime = 1 / (1 + 10 ** ((opponent.lifetime_score - self.lifetime_score) / 450))
        lifetime_score_change = K * (result - expected_score_lifetime)
        if expected_score_lifetime < 0.45 and result == 1:
            lifetime_score_change = lifetime_score_change * 1.3
        self.lifetime_score += lifetime_score_change  # Update the lifetime score
        self.score_history.append(self.lifetime_score)

        # Ensure lifetime score doesn't drop below 100
        if self.lifetime_score < 100:
            self.lifetime_score = 100

        self.update_active_status()

        # Update win/loss records
        if won:
           self.wins += 1
           if self.active:
              self.lifetime_wins += 1
        else:
           self.losses += 1
           if self.active:
              self.lifetime_losses += 1
              
        return score_change

    def win_loss_ratio(self):
        if self.games_played == 0:
            return "0/0"
        return f"{self.wins}/{self.losses}"
    
    def update_active_status(self):  # a player is "active" if they have played 3 games since the last reset
        self.active = self.games_played >= 3 
