import sys
from PyQt5.QtGui import *
from PyQt5.QtWidgets import *
from PyQt5.QtCore import *

class ScoreboardDialog(QDialog):
    def __init__(self, parent, player1_name, player2_name):
        super().__init__(parent)
        self.player1_name = player1_name
        self.player2_name = player2_name
        self.player1_score = 0
        self.player2_score = 0

        self.end_game_confirmation = False
        self.start_game_confirmation = False
        self.quit_game_confirmation = False

        self.setWindowTitle('Game Scoreboard')
        self.setStyleSheet("background-color: #282C34; color: #FFFFFF;")

        self.showFullScreen()
        '''self.setGeometry(0, 0, screen.width(), int(screen.height()*0.8))'''

        # Main layout
        self.layout = QVBoxLayout()
        self.setLayout(self.layout)

        # Players layout
        players_layout = QHBoxLayout()
        self.layout.addLayout(players_layout)

        # Player 1 section
        self.player1_group = QGroupBox()
        # self.player1_group.setStyleSheet("border: 2px solid white;")
        self.player1_group.setStyleSheet("border: 2px solid white; background-color: #4CAF50;")  # Green for Player 1
        self.player1_section = QVBoxLayout()
        self.player1_group.setLayout(self.player1_section)
        players_layout.addWidget(self.player1_group)

        self.player1_label = QLabel(f"{self.player1_name}")
        self.player1_label.setStyleSheet("font-size: 88px; font-weight: bold;")
        self.player1_label.setAlignment(Qt.AlignCenter)
        self.player1_label.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Expanding)

        self.player1_score_label = QLabel(f"{self.player1_score}")
        self.player1_score_label.setStyleSheet("font-size: 296px; font-weight: bold;")
        self.player1_score_label.setAlignment(Qt.AlignCenter)
        self.player1_score_label.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Expanding)

        self.player1_section.addWidget(self.player1_label, 1)  # 20% for name
        self.player1_section.addWidget(self.player1_score_label, 4)  # 80% for score

        self.player1_button_layout = QHBoxLayout()
        self.player1_section.addLayout(self.player1_button_layout)

        self.player1_add_button = QPushButton("+1")
        self.player1_add_button.setStyleSheet("font-size: 32px; background-color: #4CAF50; color: white;")
        self.player1_add_button.clicked.connect(lambda: self.update_score(self.player1_name, 1))
        self.player1_button_layout.addWidget(self.player1_add_button)

        self.player1_sub_button = QPushButton("-1")
        self.player1_sub_button.setStyleSheet("font-size: 32px; background-color: #F44336; color: white;")
        self.player1_sub_button.clicked.connect(lambda: self.update_score(self.player1_name, -1))
        self.player1_button_layout.addWidget(self.player1_sub_button)

        # Player 2 section
        self.player2_group = QGroupBox()
        # self.player2_group.setStyleSheet("border: 2px solid white;")
        self.player2_group.setStyleSheet("border: 2px solid white; background-color: #2196F3;")  # Blue for Player 2
        self.player2_section = QVBoxLayout()
        self.player2_group.setLayout(self.player2_section)
        players_layout.addWidget(self.player2_group)

        self.player2_label = QLabel(f"{self.player2_name}")
        self.player2_label.setStyleSheet("font-size: 88px; font-weight: bold;")
        self.player2_label.setAlignment(Qt.AlignCenter)
        self.player2_label.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Expanding)

        self.player2_score_label = QLabel(f"{self.player2_score}")
        self.player2_score_label.setStyleSheet("font-size: 296px; font-weight: bold;")
        self.player2_score_label.setAlignment(Qt.AlignCenter)
        self.player2_score_label.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Expanding)

        self.player2_section.addWidget(self.player2_label, 1)  # 20% for name
        self.player2_section.addWidget(self.player2_score_label, 4)  # 80% for score

        self.player2_button_layout = QHBoxLayout()
        self.player2_section.addLayout(self.player2_button_layout)

        self.player2_add_button = QPushButton("+1")
        self.player2_add_button.setStyleSheet("font-size: 32px; background-color: #4CAF50; color: white;")
        self.player2_add_button.clicked.connect(lambda: self.update_score(self.player2_name, 1))
        self.player2_button_layout.addWidget(self.player2_add_button)

        self.player2_sub_button = QPushButton("-1")
        self.player2_sub_button.setStyleSheet("font-size: 32px; background-color: #F44336; color: white;")
        self.player2_sub_button.clicked.connect(lambda: self.update_score(self.player2_name, -1))
        self.player2_button_layout.addWidget(self.player2_sub_button)

        # Control buttons
        self.control_button_layout = QHBoxLayout()
        self.layout.addLayout(self.control_button_layout)

        self.control_button_layout.addStretch()

        self.end_game_button = QPushButton("End Game")
        self.end_game_button.setStyleSheet("font-size: 24px; background-color: #2196F3; color: white;")
        self.end_game_button.clicked.connect(self.end_game)
        self.control_button_layout.addWidget(self.end_game_button)

        self.quit_game_button = QPushButton("Quit Game")
        self.quit_game_button.setStyleSheet("font-size: 24px; background-color: #9E9E9E; color: white;")
        self.quit_game_button.clicked.connect(self.quit_game)
        self.control_button_layout.addWidget(self.quit_game_button)

        self.control_button_layout.addStretch()

        # Message label for temporary messages
        self.message_label = QLabel("")
        self.message_label.setAlignment(Qt.AlignCenter)
        self.message_label.setStyleSheet("font-size: 24px; color: yellow;")
        self.layout.addWidget(self.message_label)
        
        self.setFocusPolicy(Qt.StrongFocus)
        self.activateWindow()
        self.setFocus()

    def update_score(self, player_name, delta):
        if player_name == self.player1_name:
            self.player1_score += delta
            self.player1_score = max(0, self.player1_score)  # Ensure score doesn't go below 0
            self.player1_score_label.setText(f"{self.player1_score}")
        else:
            self.player2_score += delta
            self.player2_score = max(0, self.player2_score)  # Ensure score doesn't go below 0
            self.player2_score_label.setText(f"{self.player2_score}")

    def keyPressEvent(self, event):
        key = event.key()
        parent = self.parent()  # Access the parent class instance

        if key == Qt.Key_1:  # End game
            if self.end_game_confirmation:
                self.end_game()
                self.end_game_confirmation = False
            else:
                self.show_temp_message('Press End Game (1) again to confirm')
                self.end_game_confirmation = True
                QTimer.singleShot(2000, self.reset_end_game_confirmation)
        elif key == Qt.Key_2:  # Start game
            if not parent.game_in_progress:  # Only start game if no game is in progress
                self.show_temp_message('Starting new game')
                parent.start_game()
            else:
                self.show_temp_message('Game already in progress')
        elif key == Qt.Key_3:  # Quit game
            if self.quit_game_confirmation:
                self.quit_game()
                self.quit_game_confirmation = False
            else:
                self.show_temp_message('Press Quit Game (3) again to confirm')
                self.quit_game_confirmation = True
                QTimer.singleShot(2000, self.reset_quit_game_confirmation)
        elif key == Qt.Key_4:  # Player 2, +1
            self.update_score(self.player2_name, 1)
        elif key == Qt.Key_5:  # Player 2, -1
            self.update_score(self.player2_name, -1)
        elif key == Qt.Key_7:  # Player 1, +1
            self.update_score(self.player1_name, 1)
        elif key == Qt.Key_8:  # Player 1, -1
            self.update_score(self.player1_name, -1)

    def show_temp_message(self, message):
        self.message_label.setText(message)
        QTimer.singleShot(2000, self.clear_temp_message)  # Clear message after 2 seconds

    def clear_temp_message(self):
        self.message_label.setText("")

    def reset_end_game_confirmation(self):
        self.end_game_confirmation = False

    def reset_start_game_confirmation(self):
        self.start_game_confirmation = False

    def reset_quit_game_confirmation(self):
        self.quit_game_confirmation = False

    def start_game(self):
        QMessageBox.information(self, 'Game Started', 'The game has started.')

    def end_game(self):
        parent = self.parent()
        player1 = parent.players[self.player1_name]
        player2 = parent.players[self.player2_name]

        # Capture current rankings before updating any scores
        # sorted_players = parent.get_sorted_players()
        # player_ranks = {name: rank + 1 for rank, (name, player) in enumerate(sorted_players)}
        # Capture current rankings before updating any scores

        # Only consider active players for ranking (those with 3 or more games)
        active_players = {name: player for name, player in parent.players.items() if player.games_played >= 3}
        sorted_active_players = sorted(active_players.items(), key=lambda x: -x[1].score)
        player_ranks = {name: rank + 1 for rank, (name, player) in enumerate(sorted_active_players)}

        if self.player1_score > self.player2_score:
            player1_score_change = player1.update_score(player2, True, self.player1_score-self.player2_score)
            player2_score_change = player2.update_score(player1, False, self.player1_score-self.player2_score)
            parent.update_history(self.player1_name, self.player2_name, self.player1_name, player1_score_change, player2_score_change, player_ranks)
        elif self.player2_score > self.player1_score:
            player1_score_change = player1.update_score(player2, False, self.player2_score-self.player1_score)
            player2_score_change = player2.update_score(player1, True, self.player2_score-self.player1_score)
            parent.update_history(self.player1_name, self.player2_name, self.player2_name, player1_score_change, player2_score_change, player_ranks)
        else:
            # Handle tie separately if required
            parent.history_display.append(f"Game between <b>{self.player1_name}</b> and <b>{self.player2_name}</b> ended in a tie with score {self.player1_score} to {self.player2_score}")

        parent.save_players()
        parent.update_leaderboard()
        parent.init_timers()
        self.close()

    def quit_game(self):
        self.parent().history_display.append(f"Game between <b>{self.player1_name}</b> and <b>{self.player2_name}</b> was quit without a winner")
        self.close()
