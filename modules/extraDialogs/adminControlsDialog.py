from PyQt5.QtGui import *
from PyQt5.QtWidgets import *
from PyQt5.QtCore import *
from modules.util import Util


class AdminControlsDialog(QDialog):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle('Admin Controls')

        self.layout = QVBoxLayout()

        # Edit player password
        self.layout.addWidget(QLabel('Edit Player Password'))
        self.player_password_dropdown = QComboBox()
        self.layout.addWidget(self.player_password_dropdown)
        self.new_password_input = QLineEdit()
        self.new_password_input.setPlaceholderText('New Password')
        self.new_password_input.setEchoMode(QLineEdit.Password)
        self.layout.addWidget(self.new_password_input)
        self.edit_password_button = QPushButton('Edit Password')
        self.edit_password_button.clicked.connect(self.edit_player_password)
        self.layout.addWidget(self.edit_password_button)

        # Edit player score
        self.layout.addWidget(QLabel('Edit Player Score'))
        self.player_score_dropdown = QComboBox()
        self.layout.addWidget(self.player_score_dropdown)
        self.new_score_input = QLineEdit()
        self.new_score_input.setPlaceholderText('New Score')
        self.layout.addWidget(self.new_score_input)
        self.edit_score_button = QPushButton('Edit Score')
        self.edit_score_button.clicked.connect(self.edit_player_score)
        self.layout.addWidget(self.edit_score_button)

        # Delete player
        self.layout.addWidget(QLabel('Delete Player'))
        self.player_delete_dropdown = QComboBox()
        self.layout.addWidget(self.player_delete_dropdown)
        self.delete_player_button = QPushButton('Delete Player')
        self.delete_player_button.clicked.connect(self.delete_player)
        self.layout.addWidget(self.delete_player_button)

        # Reset all scores
        self.reset_button = QPushButton('Reset All Scores')
        self.reset_button.clicked.connect(self.reset_all_scores)
        self.layout.addWidget(self.reset_button)

        self.setLayout(self.layout)

    def set_players(self, players):
        player_names = sorted(players.keys())
        self.player_password_dropdown.addItems(player_names)
        self.player_score_dropdown.addItems(player_names)
        self.player_delete_dropdown.addItems(player_names)

    def edit_player_password(self):
        player_name = self.player_password_dropdown.currentText()
        new_password = self.new_password_input.text().strip()
        if player_name and new_password:
            self.parent().players[player_name].password = new_password
            Util.save_players(self.parent())
            self.new_password_input.clear()

    def edit_player_score(self):
        player_name = self.player_score_dropdown.currentText()
        try:
            new_score = float(self.new_score_input.text().strip())
            if player_name:
                self.parent().players[player_name].score = new_score
                Util.save_players(self.parent())
                self.parent().update_leaderboard()
                self.new_score_input.clear()
        except ValueError:
            pass

    def delete_player(self):
        player_name = self.player_delete_dropdown.currentText()
        if player_name:
            del self.parent().players[player_name]
            Util.save_players(self.parent())
            self.parent().update_dropdowns()
            self.parent().update_leaderboard()

    def reset_all_scores(self):
        for player in self.parent().players.values():
            player.score = 1000
            player.games_played = 0
            player.wins = 0
            player.losses = 0
        Util.save_players(self.parent())
        self.parent().update_leaderboard()
