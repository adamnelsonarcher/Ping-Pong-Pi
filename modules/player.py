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
            K = K*1.15 # Both players are unranked, 15% increase in volatility
        elif player_is_unranked:
            K = K*1.15 # 15% increase in volatility for unranked player
        elif opponent_is_unranked:
            K = 20   # The ranked player only gains/loses a maximum of 20 points
        else:
            pass  # Both players are ranked, normal scoring applies

        result = 1 if won else 0
        expected_score = 1 / (1 + 10 ** ((opponent.score - self.score) / 400))
        score_change = K * (result - expected_score)
        self.score += score_change
        self.games_played += 1

        # Update lifetime stats only if the player is active (has played at least 3 games)
        self.lifetime_games_played += 1
        if self.active:
            self.lifetime_score += score_change
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
