import sys
from PyQt5.QtGui import *
from PyQt5.QtWidgets import *
from PyQt5.QtCore import *
import os

from modules.player import Player


class Util:

    global player_path, score_hist_path, game_hist_path
    player_path = r'./game_data/players.txt'
    score_hist_path = r'./game_data/score_history.txt'
    game_hist_path = r'./game_data/game_history.txt'

    def reset_timers(parent):
        try:
            parent.clear_selection_timer.start()
        except:
            pass

    # file loading and saving
    def load_game_history(parent):
        # Optionally clear existing content
        parent.history_display.clear()

        # Set a title for the history display using HTML
        parent.history_display.setHtml("<h2>Game History</h2>")

        # Load existing history from a file
        try:
            with open(game_hist_path, 'r') as file:
                entries = file.readlines()

            for entry in entries:
                # update_history_from_file(entry.strip())
                message = f"<div>{entry.strip()}</div>"
                parent.history_display.append(message)
        except FileNotFoundError:
            print("History file not found. Starting with an empty history.")

    def load_players(parent):
        filepath = player_path  # Ensure this is the correct path
        try:
            with open(filepath, 'r') as file:
                for line in file:
                    parts = line.strip().split(',')
                    name = parts[0]
                    score = float(parts[1])  # Convert score to float
                    games_played = int(parts[2])
                    wins = int(parts[3])
                    losses = int(parts[4])
                    password = parts[5]
                    lifetime_games_played = int(parts[6])
                    lifetime_wins = int(parts[7])
                    lifetime_losses = int(parts[8])
                    lifetime_score = float(parts[9])
                    current_streak = int(parts[10])
                    if name not in parent.players:
                        parent.players[name] = Player(name, score, password)
                        parent.players[name].games_played = games_played
                        parent.players[name].wins = wins
                        parent.players[name].losses = losses
                        # added in v2.0
                        parent.players[name].lifetime_games_played = lifetime_games_played
                        parent.players[name].lifetime_wins = lifetime_wins
                        parent.players[name].lifetime_losses = lifetime_losses
                        parent.players[name].lifetime_score = lifetime_score
                        # added in v2.3
                        parent.players[name].current_streak = current_streak 

                        parent.players[name].update_active_status()

        except FileNotFoundError:
            print(f"No existing player data file found at {filepath}. Starting with an empty player list.")
        except Exception as e:
            print(f"Error loading players from {filepath}: {e}")
        if not os.path.exists(score_hist_path):
            print("Score history file does not exist, starting fresh.")
            return
        try:
            with open(score_hist_path, 'r') as file:
                for line in file:
                    parts = line.strip().split(',')
                    name = parts[0]
                    scores = list(map(float, parts[1:]))
                    if name in parent.players:
                        parent.players[name].score_history = scores
            print("Score history loaded successfully.")
        except Exception as e:
            print(f"Failed to load score history: {e}")

    def save_players(parent):
        try:
            with open(player_path, 'w') as file:
                for player in parent.players.values():
                    file.write(
                        f"{player.name},{player.score},{player.games_played},{player.wins},{player.losses},"
                        f"{player.password},{player.lifetime_games_played},{player.lifetime_wins},{player.lifetime_losses},"
                        f"{player.lifetime_score:.2f},{player.current_streak}\n")
            print("Players saved successfully.")  # Debug print
        except Exception as e:
            print(f"Failed to save players: {e}")
        try:
            with open(score_hist_path, 'w') as file:
                for name, player in parent.players.items():
                    # Write the player's name followed by their score history
                    scores = ','.join(map(str, player.score_history))
                    file.write(f"{name},{scores}\n")
            print("Score history saved successfully.")
        except Exception as e:
            print(f"Failed to save score history: {e}")

    def limit_game_history(parent):
        try:
            with open(parent.game_history_path, 'r') as file:
                lines = file.readlines()

            # Keep only the last 30 entries
            if len(lines) > 30:
                with open(parent.game_history_path, 'w') as file:
                    file.writelines(lines[-30:])

        except FileNotFoundError:
            # Create the file if it doesn't exist
            open(parent.game_history_path, 'w').close()
